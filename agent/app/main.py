# agent/app/main.py
import logging
import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel
from dotenv import load_dotenv

from .utils import wg

load_dotenv()  # load agent/.env if present

AGENT_SHARED_SECRET = os.getenv("AGENT_SHARED_SECRET")
WG_INTERFACE = os.getenv("WG_INTERFACE", "wg0")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
log = logging.getLogger("agent")

if not AGENT_SHARED_SECRET:
    raise RuntimeError("AGENT_SHARED_SECRET missing in environment")

app = FastAPI(title="ArticVPN WireGuard Agent")

def require_agent_secret(x_agent_secret: Optional[str]) -> None:
    if not x_agent_secret or x_agent_secret != AGENT_SHARED_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized agent request")

class AddPeerIn(BaseModel):
    public_key: str
    allowed_ips: str               # e.g., "10.8.0.12/32"
    persistent_keepalive: Optional[int] = None  # e.g., 25

class RemovePeerIn(BaseModel):
    public_key: str

class OpOut(BaseModel):
    ok: bool
    detail: Optional[str] = None
    dry_run: bool = False

@app.post("/agent/wg/add-peer", response_model=OpOut)
def add_peer(
    body: AddPeerIn,
    x_agent_secret: Optional[str] = Header(None, convert_underscores=False),
):
    require_agent_secret(x_agent_secret)
    try:
        res = wg.add_peer(
            public_key=body.public_key,
            allowed_ips=body.allowed_ips,
            interface=WG_INTERFACE,
            persistent_keepalive=body.persistent_keepalive,
            dry_run=DRY_RUN,
        )
        return OpOut(ok=True, dry_run=res.get("dry_run", False))
    except Exception as e:
        log.exception("add-peer failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/wg/remove-peer", response_model=OpOut)
def remove_peer(
    body: RemovePeerIn,
    x_agent_secret: Optional[str] = Header(None, convert_underscores=False),
):
    require_agent_secret(x_agent_secret)
    try:
        res = wg.remove_peer(
            public_key=body.public_key,
            interface=WG_INTERFACE,
            dry_run=DRY_RUN,
        )
        return OpOut(ok=True, dry_run=res.get("dry_run", False))
    except Exception as e:
        log.exception("remove-peer failed")
        raise HTTPException(status_code=500, detail=str(e))