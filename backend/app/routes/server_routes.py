from fastapi import APIRouter, Depends, HTTPException
from app.models import vpn_servers
from app.database import database
from app.auth import get_current_user
from app.schemas import VPNServerCreate, VPNServerUpdate

router = APIRouter()

@router.get("/servers")
async def get_servers():
    query = vpn_servers.select().where(vpn_servers.c.is_active == True)
    results = await database.fetch_all(query)
    return results

@router.post("/servers")
async def add_vpn_server(
    server: VPNServerCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    query = vpn_servers.insert().values(**server.dict())
    server_id = await database.execute(query)
    return {"message": "Server added", "id": server_id}

@router.put("/servers/{server_id}")
async def update_vpn_server(
    server_id: int,
    server_data: VPNServerUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build a dictionary of the fields to update
    update_fields = {k: v for k, v in server_data.dict().items() if v is not None}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    query = vpn_servers.update().where(vpn_servers.c.id == server_id).values(**update_fields)
    await database.execute(query)
    
    return {"message": f"Server {server_id} updated", "fields": update_fields}

@router.delete("/servers/{server_id}")
async def delete_vpn_server(
    server_id: int,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    #Mark server as inactive instead of deleting
    query = vpn_servers.update().where(vpn_servers.c.id == server_id).values(is_active=False)
    await database.execute(query)
    return {"message": f"Server {server_id} Marked as inactive"}