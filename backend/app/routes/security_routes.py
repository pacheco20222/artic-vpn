import pyotp
import qrcode
import io
import base64
import secrets
import string
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from app.models import twofa_secrets
from app.models import recovery_codes
from app.database import database
from app.auth import get_current_user
from app.schemas import TwoFAVerify

router = APIRouter()

@router.post("/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_user)):
    # Step 1: generate a base32 secret
    secret = pyotp.random_base32()

    # Step 2: store in DB (overwrite if exists)
    delete_query = twofa_secrets.delete().where(twofa_secrets.c.user_id == current_user["user_id"])
    await database.execute(delete_query)

    insert_query = twofa_secrets.insert().values(user_id=current_user["user_id"], secret_key=secret)
    await database.execute(insert_query)

    # Step 3: create a TOTP URI
    totp = pyotp.TOTP(secret)
    otp_uri = totp.provisioning_uri(name=current_user["username"], issuer_name="ArticVPN")

    # Step 4: generate QR code as base64
    qr = qrcode.make(otp_uri)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    data_url = f"data:image/png;base64,{img_base64}"

    return {
        "message": "2FA setup complete",
        # Frontend-friendly data URL for direct <img src="..." /> usage
        "qr_data_url": data_url,
        # Keep base64 for compatibility/debugging
        "qr_code_base64": img_base64,
        # Manual entry fallback
        "secret": secret
    }
    
@router.post("/2fa/verify")
async def verify_2fa(
    body: TwoFAVerify,
    current_user: dict = Depends(get_current_user)
):
    # Get the user's 2FA secret
    query = twofa_secrets.select().where(twofa_secrets.c.user_id == current_user["user_id"])
    result = await database.fetch_one(query)
    if not result:
        raise HTTPException(status_code=400, detail="2FA not set up for this user")
    
    secret = result["secret_key"]
    totp = pyotp.TOTP(secret)
    
    # Verify the OTP
    if totp.verify(body.code, valid_window=1):
        return {"message": "2FA verification successful"}
    else:
        raise HTTPException(status_code=400, detail="Invalid 2FA code")
    
@router.get("/2fa/status")
async def twofa_status(current_user: dict = Depends(get_current_user)):
    rec = await database.fetch_one(
        twofa_secrets.select().where(twofa_secrets.c.user_id == current_user["user_id"])
    )
    return {"enabled": bool(rec)}


# --- Recovery codes and 2FA rotation endpoints ---

@router.post("/2fa/recovery-codes")
async def generate_recovery_codes(current_user: dict = Depends(get_current_user)):
    """
    Generate a fresh set of one-time recovery codes for the current user.
    Plaintext codes are returned once; only hashes are stored.
    Regenerating will invalidate (delete) any existing, unused codes.
    """
    user_id = current_user["user_id"]

    # 1) Invalidate existing codes for this user
    delete_query = recovery_codes.delete().where(recovery_codes.c.user_id == user_id)
    await database.execute(delete_query)

    # 2) Generate 10 random codes (e.g., 10 chars each, avoiding ambiguous chars)
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no I, O, 0, 1
    def make_code(n: int = 10) -> str:
        return "".join(secrets.choice(alphabet) for _ in range(n))

    plaintext_codes = [make_code(10) for _ in range(10)]

    # 3) Hash codes and store
    def hash_code(code: str) -> str:
        # Fast non-reversible hash; could be replaced with bcrypt if desired
        return hashlib.sha256(code.encode("utf-8")).hexdigest()

    values = [
        {"user_id": user_id, "code_hash": hash_code(code)}
        for code in plaintext_codes
    ]
    # databases supports execute_many via the insert() with values list
    insert_query = recovery_codes.insert()
    await database.execute_many(query=insert_query, values=values)

    # 4) Return the plaintext once
    return {"recovery_codes": plaintext_codes}


@router.post("/2fa/rotate")
async def rotate_twofa(current_user: dict = Depends(get_current_user)):
    """
    Rotate (regenerate) the user's TOTP secret and return a new QR + secret.
    This does not verify; the user must confirm with /2fa/verify afterwards.
    Also invalidates existing recovery codes (encouraging regeneration).
    """
    user_id = current_user["user_id"]

    # Generate new base32 secret
    new_secret = pyotp.random_base32()

    # Replace any existing secret
    await database.execute(
        twofa_secrets.delete().where(twofa_secrets.c.user_id == user_id)
    )
    await database.execute(
        twofa_secrets.insert().values(user_id=user_id, secret_key=new_secret)
    )

    # Invalidate any existing recovery codes so the user generates fresh ones
    await database.execute(
        recovery_codes.delete().where(recovery_codes.c.user_id == user_id)
    )

    # Build provisioning URI and QR (same style as setup)
    totp = pyotp.TOTP(new_secret)
    otp_uri = totp.provisioning_uri(name=current_user["username"], issuer_name="ArticVPN")

    qr = qrcode.make(otp_uri)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    data_url = f"data:image/png;base64,{img_base64}"

    return {
        "message": "2FA secret rotated. Please scan the new QR and verify.",
        "qr_data_url": data_url,
        "qr_code_base64": img_base64,
        "secret": new_secret,
    }