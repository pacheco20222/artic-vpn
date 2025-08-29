from fastapi import APIRouter, HTTPException, Depends
from app.schemas import UserCreate, UserLogin, ConnectRequest
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
from sqlalchemy import select, join, and_
import httpx

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

# Alias endpoint for /signup
@router.post("/signup")
async def signup_user(user: UserCreate):
    return await register_user(user)

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
        "user_id": db_user["id"],
    }
    token = create_access_token(payload)
    return {"access_token": token, "token_type": "bearer", "user_id": db_user["id"]}


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    row = await database.fetch_one(
        users.select().where(users.c.id == uid)
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    twofa = await database.fetch_one(
        twofa_secrets.select().where(twofa_secrets.c.user_id == uid)
    )
    return {
        "user" : {
            "user_id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "is_active": row["is_active"],
            "created_at": row["created_at"],
            "twofa_enabled": bool(twofa)
        }
    }

@router.post("/connect")
async def connect_to_server(
    payload: ConnectRequest,
    current_user: dict = Depends(get_current_user)
):
    # Ensure the server exists and is active
    server = await database.fetch_one(
        vpn_servers.select().where(vpn_servers.c.id == payload.server_id)
    )
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    if not server["is_active"]:
        raise HTTPException(status_code=400, detail="Server is inactive")

    # Check if the user is already connected
    existing = await database.fetch_one(
        connections.select().where(
            (connections.c.user_id == current_user["user_id"]) &
            (connections.c.disconnected_at.is_(None))
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already connected to a server")

    # Insert a new connection record
    insert_query = connections.insert().values(
        user_id=current_user["user_id"],
        server_id=payload.server_id,
    )
    await database.execute(insert_query)

    # Call VPN Agent to apply the peer
    try:
        AGENT_URL = os.getenv("AGENT_URL")
        AGENT_SECRET = os.getenv("AGENT_SHARED_SECRET")

        # Build peer payload
        peer_payload = {
            "public_key": payload.public_key,
            "allowed_ips": payload.allowed_ips,
            "persistent_keepalive": 25
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{AGENT_URL}/agent/wg/add-peer",
                json=peer_payload,
                headers={"X-Agent-Secret": AGENT_SECRET}
            )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to apply peer on VPN agent")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    return {"message": f"Connected to server {payload.server_id}"}

@router.post("/disconnect")
async def disconnect_from_vpn(
    current_user: dict = Depends(get_current_user)
):
    # Find the latest active connection for this user
    query = connections.select().where(
        (connections.c.user_id == current_user["user_id"]) & 
        (connections.c.disconnected_at.is_(None))
    ).order_by(connections.c.connected_at.desc())

    session = await database.fetch_one(query)
    if not session:
        raise HTTPException(status_code=400, detail="No active connection found")

    now_utc = datetime.datetime.utcnow()
    update_query = connections.update().where(
        connections.c.id == session["id"]
    ).values(disconnected_at=now_utc)
    await database.execute(update_query)

    return {
        "message": f"Disconnected from server {session['server_id']}",
        "connection_id": session["id"],
        "disconnected_at": now_utc
    }
    
@router.get("/my-connections")
async def list_user_connections(current_user: dict = Depends(get_current_user)):
    # Perform a JOIN between connections and vpn_servers
    j = join(connections, vpn_servers, connections.c.server_id == vpn_servers.c.id)

    query = (
        select(
            connections.c.id.label("id"),
            connections.c.server_id.label("server_id"),
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


@router.get("/me/connection")
async def get_current_connection(current_user: dict = Depends(get_current_user)):
    # Join connections with vpn_servers to include server details
    j = join(connections, vpn_servers, connections.c.server_id == vpn_servers.c.id)

    query = (
        select(
            connections.c.id.label("connection_id"),
            connections.c.connected_at,
            vpn_servers.c.id.label("server_id"),
            vpn_servers.c.name,
            vpn_servers.c.country,
            vpn_servers.c.ip_address,
        )
        .select_from(j)
        .where(
            (connections.c.user_id == current_user["user_id"]) &
            (connections.c.disconnected_at.is_(None))
        )
        .limit(1)
    )

    row = await database.fetch_one(query)
    if not row:
        return None

    return {
        "id": row["connection_id"],
        "user_id": current_user["user_id"],
        "server_id": row["server_id"],
        "connected_at": row["connected_at"],
        "disconnected_at": None,
    }