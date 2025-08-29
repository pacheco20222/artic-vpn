from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
import os
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR, HTTP_401_UNAUTHORIZED

router = APIRouter()

# Load environment variables
AGENT_URL = os.getenv("AGENT_URL", "http://localhost:8001")
AGENT_SHARED_SECRET = os.getenv("AGENT_SHARED_SECRET")

if not AGENT_SHARED_SECRET:
    raise RuntimeError("AGENT_SHARED_SECRET is not set in environment variables.")


# Input model for adding a peer
class AddPeerIn(BaseModel):
    client_public_key: str
    client_ip: str
    server_public_key: str
    server_endpoint: str  # IP:Port
    allowed_ips: list[str]


@router.post("/connect-to-vpn")
async def connect_to_vpn(data: AddPeerIn):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{AGENT_URL}/agent/wg/add-peer",
                json=data.dict(),
                headers={"X-Agent-Secret": AGENT_SHARED_SECRET}
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Agent error: {response.status_code} - {response.text}"
            )

        return {"status": "success", "detail": "Peer added on server"}

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reach agent: {str(e)}"
        )


# Optional: disconnect route
class RemovePeerIn(BaseModel):
    client_public_key: str


@router.post("/disconnect-from-vpn")
async def disconnect_from_vpn(data: RemovePeerIn):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{AGENT_URL}/agent/wg/remove-peer",
                json=data.dict(),
                headers={"X-Agent-Secret": AGENT_SHARED_SECRET}
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Agent error: {response.status_code} - {response.text}"
            )

        return {"status": "success", "detail": "Peer removed from server"}

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reach agent: {str(e)}"
        )