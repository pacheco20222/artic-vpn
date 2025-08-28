from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from app.models import vpn_servers, wg_allocations
from app.database import database
from app.auth import get_current_user
from app.schemas import VPNServerCreate, VPNServerUpdate, VPNServerOut
from app.utils.wireguard import generate_keypair, next_free_ip, render_client_config, config_to_qr_data_url
from app.schemas import WGConfigResponse

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


# --- WireGuard config endpoint ---
@router.post("/{server_id}/wireguard/config", response_model=WGConfigResponse)
async def generate_wireguard_config(
    server_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Allocate a /32, generate a client keypair, store public key, and return
    a WireGuard client config + QR (simulation mode).
    """
    # 1) Fetch server and validate WG fields
    server_row = await database.fetch_one(
        select(vpn_servers).where(vpn_servers.c.id == server_id)
    )
    if not server_row:
        raise HTTPException(status_code=404, detail="Server not found")

    if not server_row["is_active"]:
        raise HTTPException(status_code=400, detail="Server is inactive")

    if not server_row.get("wg_public_key") or not server_row.get("wg_endpoint"):
        raise HTTPException(
            status_code=400,
            detail="Server missing WireGuard settings (wg_public_key/wg_endpoint)",
        )

    # 2) Allocate next free client IP for this server
    try:
        client_ip_with_prefix = await next_free_ip(database, server_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    # 3) Generate simulated keypair and persist allocation (store public only)
    client_priv, client_pub = generate_keypair()

    await database.execute(
        wg_allocations.insert().values(
            user_id=current_user["id"],
            server_id=server_id,
            client_ip=client_ip_with_prefix,
            client_public_key=client_pub,
        )
    )

    # 4) Render client config & QR
    config_text = render_client_config(
        dict(server_row), client_priv, client_ip_with_prefix
    )

    try:
        qr_data_url = config_to_qr_data_url(config_text)
    except RuntimeError as exc:
        # qrcode not installed: return config only with an informative message embedded
        qr_data_url = ""

    return WGConfigResponse(
        config_text=config_text,
        qr_code_data_url=qr_data_url,
        allocated_ip=client_ip_with_prefix,
    )


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