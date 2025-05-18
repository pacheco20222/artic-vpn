from fastapi import APIRouter, HTTPException, Depends
from app.schemas import UserCreate, UserLogin
from app.database import database
from app.models import users
import bcrypt
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer
import os
from dotenv import load_dotenv
from app.auth import get_current_user, create_access_token

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
    query = users.select().where(users.c.username == user.username)
    db_user = await database.fetch_one(query)
    
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    # Verify the password
    if not bcrypt.checkpw(user.password.encode('utf-8'), db_user['hashed_password'].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    # Create JWT token
    payload = {
        "sub": user.username,
        "user_id": db_user['id'],
    }
    token = create_access_token(data=payload)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {
        "message": "This is your profile.",
        "user": current_user
    }