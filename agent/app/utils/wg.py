# agent/app/utils/wg.py
import os
import shutil
import subprocess
import logging
from typing import Optional, Dict, Any

log = logging.getLogger(__name__)

def _has_wg() -> bool:
    return shutil.which("wg") is not None

def add_peer(
    public_key: str,
    allowed_ips: str,
    interface: str = "wg0",
    persistent_keepalive: Optional[int] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Equivalent to:
      wg set wg0 peer <public_key> allowed-ips <ip/32> [persistent-keepalive <N>]
    """
    cmd = ["wg", "set", interface, "peer", public_key, "allowed-ips", allowed_ips]
    if persistent_keepalive is not None:
        cmd += ["persistent-keepalive", str(persistent_keepalive)]

    if dry_run or not _has_wg():
        log.info("[DRY-RUN] %s", " ".join(cmd))
        return {"ok": True, "dry_run": True, "cmd": cmd}

    # real call
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        log.error("wg add-peer failed: %s", res.stderr.strip())
        raise RuntimeError(res.stderr.strip() or "wg set failed")
    return {"ok": True, "dry_run": False, "stdout": res.stdout.strip()}

def remove_peer(
    public_key: str,
    interface: str = "wg0",
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Equivalent to:
      wg set wg0 peer <public_key> remove
    """
    cmd = ["wg", "set", interface, "peer", public_key, "remove"]

    if dry_run or not _has_wg():
        log.info("[DRY-RUN] %s", " ".join(cmd))
        return {"ok": True, "dry_run": True, "cmd": cmd}

    # real call
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        log.error("wg remove-peer failed: %s", res.stderr.strip())
        raise RuntimeError(res.stderr.strip() or "wg set remove failed")
    return {"ok": True, "dry_run": False, "stdout": res.stdout.strip()}