import pyotp
import qrcode
import io
import base64
from fastapi import APIRouter, Depends, HTTPException
from app.models import twofa_secrets
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

    return {
        "message": "2FA setup complete",
        "qr_code_base64": img_base64,  # display in frontend
        "secret": secret  # for manual entry
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
    if totp.verify(body.code):
        return {"message": "2FA verification successful"}
    else:
        raise HTTPException(status_code=400, detail="Invalid 2FA code")