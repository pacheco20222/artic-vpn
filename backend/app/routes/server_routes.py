from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from app.models import vpn_servers
from app.database import database
from app.auth import get_current_user
from app.schemas import VPNServerCreate, VPNServerUpdate, VPNServerOut

router = APIRouter(prefix="/servers", tags=["servers"])


@router.get("", response_model=List[VPNServerOut])
async def get_servers(only_active: bool = True) -> List[VPNServerOut]:
    """List VPN servers. By default returns only active servers.
    Set `only_active=false` to retrieve all (admin UIs may use this).
    """
    query = select(vpn_servers)
    if only_active:
        query = query.where(vpn_servers.c.is_active == True)  # noqa: E712
    results = await database.fetch_all(query)
    return results  # FastAPI + Pydantic will coerce to VPNServerOut


@router.get("/{server_id}", response_model=Optional[VPNServerOut])
async def get_server_by_id(server_id: int) -> Optional[VPNServerOut]:
    row = await database.fetch_one(
        select(vpn_servers).where(vpn_servers.c.id == server_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Server not found")
    return row


@router.post("", status_code=201)
async def add_vpn_server(
    server: VPNServerCreate,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Pydantic v2 -> model_dump(); v1 would be dict()
    values = server.model_dump()
    server_id = await database.execute(vpn_servers.insert().values(**values))
    return {"message": "Server added", "id": server_id}


@router.put("/{server_id}")
async def update_vpn_server(
    server_id: int,
    server_data: VPNServerUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Only include fields provided by the client
    update_fields = server_data.model_dump(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Ensure server exists
    exists = await database.fetch_one(
        select(vpn_servers.c.id).where(vpn_servers.c.id == server_id)
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Server not found")

    await database.execute(
        vpn_servers.update().where(vpn_servers.c.id == server_id).values(**update_fields)
    )
    return {"message": f"Server {server_id} updated", "fields": update_fields}


@router.delete("/{server_id}")
async def delete_vpn_server(
    server_id: int,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Soft-delete: mark inactive instead of removing
    # Also ensure it exists first
    exists = await database.fetch_one(
        select(vpn_servers.c.id).where(vpn_servers.c.id == server_id)
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Server not found")

    await database.execute(
        vpn_servers.update().where(vpn_servers.c.id == server_id).values(is_active=False)
    )
    return {"message": f"Server {server_id} marked as inactive"}