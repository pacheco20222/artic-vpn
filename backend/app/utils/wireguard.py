from __future__ import annotations

import base64
import io
import os
import re
import secrets
from ipaddress import ip_network, ip_address
from typing import Optional, Tuple, Iterable, Set

from databases import Database
from sqlalchemy import select

from app.models import wg_allocations, vpn_servers

def _b64_32_bytes() -> str:
    raw = os.urandom(32)
    return base64.standard_b64encode(raw).decode(ascii)

def generate_keypair() -> Tuple[str, str]:
    priv = _b64_32_bytes()
    pub = _b64_32_bytes()
    return priv, pub

_DEFAULT_CIDR = "10.8.0.0/24"

async def next_free_ip(
    database: Database,
    server_id: int,
    base_cidr: str = _DEFAULT_CIDR,
    start_host_index: int = 10,
) -> str:
    query = (
        select(wg_allocations.c.client_ip).where(wg_allocations.c.server_id == server_id).where(wg_allocations.c.revoked_at.is_(None))
    )
    rows = await database.fetch_all(query)
    taken: Set[str] = set()
    for r in rows:
        ip_str = str(r[0])
        if "/" in ip_str:
            ip_str = ip_str.split("/", 1)[0]
        taken.add(ip_str)
    net = ip_network(base_cidr)
    
    
"""WireGuard helper utilities (simulation-friendly).

This module centralizes the small pieces we need to:
- generate a client keypair (simulation for now),
- find the next free /32 tunnel IP on a server,
- render a client .conf file from DB rows,
- encode the config as a QR (data URL) for mobile WireGuard apps.

In Step 4 (real server integration), we'll swap the key generation to use
real Curve25519 keys and push peers via an agent or SSH.
"""
from __future__ import annotations

import base64
import io
import os
import re
import secrets
from ipaddress import ip_network, ip_address
from typing import Optional, Tuple, Iterable, Set

from databases import Database
from sqlalchemy import select

from app.models import wg_allocations, vpn_servers


# -----------------------------
# Key generation (simulation)
# -----------------------------

def _b64_32_bytes() -> str:
    """Return a base64 string that *looks* like a WG key (44 chars including '=' padding).
    WireGuard private/public keys are base64-encoded 32-byte values.
    For simulation we return a random 32-byte base64 string.
    """
    raw = os.urandom(32)
    return base64.standard_b64encode(raw).decode("ascii")


def generate_keypair() -> Tuple[str, str]:
    """Generate a (private_key, public_key) pair.

    Simulation mode: both are random base64-encoded 32-byte strings. In real
    WG we would derive `public_key` from `private_key` using Curve25519.
    Later we can replace this with NaCl (pynacl) or `wg` CLI when we wire up
    real servers. For now this is sufficient to render configs & QR codes.
    """
    priv = _b64_32_bytes()
    pub = _b64_32_bytes()
    return priv, pub


# ----------------------------------
# IP allocation (10.8.0.0/24 by default)
# ----------------------------------

_DEFAULT_CIDR = "10.8.0.0/24"


async def next_free_ip(
    database: Database,
    server_id: int,
    base_cidr: str = _DEFAULT_CIDR,
    start_host_index: int = 10,
) -> str:
    """Pick the next free /32 IP for a given server.

    - base_cidr: the tunnel network (default 10.8.0.0/24)
    - start_host_index: skip the first N-1 hosts (reserve .1-.9 for server/gateway)

    Returns the IP *with* "/32" suffix (WireGuard Address format), e.g. "10.8.0.10/32".
    Raises RuntimeError if no free address is available.
    """
    # Fetch allocated IPs for this server (only active allocations)
    query = (
        select(wg_allocations.c.client_ip)
        .where(wg_allocations.c.server_id == server_id)
        .where(wg_allocations.c.revoked_at.is_(None))
    )
    rows = await database.fetch_all(query)

    # Normalize to bare IP strings (strip optional /32)
    taken: Set[str] = set()
    for r in rows:
        ip_str = str(r[0])
        if "/" in ip_str:
            ip_str = ip_str.split("/", 1)[0]
        taken.add(ip_str)

    net = ip_network(base_cidr)

    # Iterate hosts, skip the first (start_host_index-1) hosts
    for idx, host in enumerate(net.hosts(), start=1):
        if idx < start_host_index:
            continue
        candidate = str(host)
        if candidate not in taken:
            return f"{candidate}/32"

    raise RuntimeError("No free WireGuard client IPs available in this subnet")


# ----------------------------------
# Config rendering
# ----------------------------------

_DEF_ALLOWED = "0.0.0.0/0, ::/0"


def render_client_config(
    server_row: dict,
    client_private_key: str,
    client_ip_with_prefix: str,
    persistent_keepalive: int = 25,
) -> str:
    """Build a WireGuard client .conf text using server fields and client keys.

    server_row is expected to expose keys:
      - wg_public_key (required)
      - wg_endpoint (required)
      - wg_allowed_ips (optional; defaults to full-tunnel)
      - wg_dns (optional)
    """
    pubkey = server_row.get("wg_public_key")
    endpoint = server_row.get("wg_endpoint")
    allowed = server_row.get("wg_allowed_ips") or _DEF_ALLOWED
    dns = server_row.get("wg_dns")

    if not pubkey or not endpoint:
        raise ValueError("Server is missing WireGuard configuration (public key/endpoint)")

    lines = []
    lines.append("[Interface]")
    lines.append(f"PrivateKey = {client_private_key}")
    lines.append(f"Address = {client_ip_with_prefix}")
    if dns:
        lines.append(f"DNS = {dns}")
    lines.append("")
    lines.append("[Peer]")
    lines.append(f"PublicKey = {pubkey}")
    lines.append(f"AllowedIPs = {allowed}")
    lines.append(f"Endpoint = {endpoint}")
    if persistent_keepalive:
        lines.append(f"PersistentKeepalive = {persistent_keepalive}")

    return "\n".join(lines) + "\n"


# ----------------------------------
# QR generation (data URL)
# ----------------------------------

def config_to_qr_data_url(config_text: str) -> str:
    """Return a data URL PNG QR for the given config text.

    Requires the `qrcode` package with PIL backend: `pip install qrcode[pil]`.
    If the dependency is missing, we raise a clear error so the route can handle it.
    """
    try:
        import qrcode  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "QR generation requires the 'qrcode[pil]' package. Install with: pip install qrcode[pil]"
        ) from exc

    img = qrcode.make(config_text)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"