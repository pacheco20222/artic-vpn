from fastapi import APIRouter, HTTPException, Depends
from app.schemas import UserCreate, UserLogin
from app.database import database
from app.models import users, connections, twofa_secrets, vpn_servers
import bcrypt
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer
import os
from dotenv import load_dotenv
from app.auth import get_current_user, create_access_token
import datetime
import pyotp
from sqlalchemy import select, join

load_dotenv()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

@router.post("/register")
async def register_user(user: UserCreate):
    query = users.select().where((users.c.username == user.username) | (users.c.email == user.email))
    existing_user = await database.fetch_one(query)
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    hashed_pw = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
    insert_query = users.insert().values(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pw.decode('utf-8')
    )
    await database.execute(insert_query)
    return {"message": f"User {user.username} registered successfully"}

@router.post("/login")
async def login_user(user: UserLogin):
    # Look up user
    query = users.select().where(users.c.username == user.username)
    db_user = await database.fetch_one(query)

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid username or password")

    # Check password
    if not bcrypt.checkpw(user.password.encode("utf-8"), db_user["hashed_password"].encode("utf-8")):
        raise HTTPException(status_code=400, detail="Invalid username or password")

    # Check if user has 2FA enabled
    twofa_query = twofa_secrets.select().where(twofa_secrets.c.user_id == db_user["id"])
    secret_record = await database.fetch_one(twofa_query)

    if secret_record:
        # User has 2FA, so they must provide a valid code
        if not user.twofa_code:
            raise HTTPException(status_code=401, detail="2FA code required")

        totp = pyotp.TOTP(secret_record["secret_key"])
        if not totp.verify(user.twofa_code):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")

    # Step 4: Generate token if all checks pass
    payload = {
        "sub": user.username,
        "user_id": db_user["id"]
    }
    token = create_access_token(payload)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {
        "message": "This is your profile.",
        "user": current_user
    }

@router.post("/connect")
async def connect_to_server(
    server_id: int,
    current_user: dict = Depends(get_current_user)
):
    # Check if the user is already connected to a server
    query = connections.select().where(
        (connections.c.user_id == current_user["user_id"]) &
        (connections.c.disconnected_at == None)
    )
    existing = await database.fetch_one(query)
    
    if existing:
        raise HTTPException(status_code=400, detail="Already connected to a server")
    
    # Insert a new connection record
    insert_query = connections.insert().values(
        user_id=current_user["user_id"],
        server_id=server_id,
    )
    await database.execute(insert_query)
    return {"message": f"Connected to server {server_id}"}

@router.post("/disconnect")
async def disconnect_from_vpn(
    current_user: dict = Depends(get_current_user)
):
    # Find the connection record
    query = connections.select().where(
        (connections.c.user_id == current_user["user_id"]) & 
        (connections.c.disconnected_at.is_(None))
    ).order_by(connections.c.connected_at.desc())
    
    session = await database.fetch_one(query)
    if not session:
        raise HTTPException(status_code=400, detail="No active connection found")
    
    # Mark the connection as disconnected
    update_query = connections.update().where(
        connections.c.id == session["id"]
    ).values(disconnected_at=datetime.datetime.utcnow())
    await database.execute(update_query)
    
    return {
        "message": f"Disconnected from server {session['server_id']}",
        "disconnected_at": datetime.datetime.utcnow()
    }
    
@router.get("/my-connections")
async def list_user_connections(current_user: dict = Depends(get_current_user)):
    # Perform a JOIN between connections and vpn_servers
    j = join(connections, vpn_servers, connections.c.server_id == vpn_servers.c.id)

    query = (
        select(
            connections.c.connected_at,
            connections.c.disconnected_at,
            vpn_servers.c.name.label("server_name"),
            vpn_servers.c.country.label("country"),
            vpn_servers.c.ip_address.label("server_ip")
        )
        .select_from(j)
        .where(connections.c.user_id == current_user["user_id"])
        .order_by(connections.c.connected_at.desc())
    )

    result = await database.fetch_all(query)
    return {"connections": result}