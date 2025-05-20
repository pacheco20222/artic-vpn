from jose import jwt, JWTError
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
import os
from dotenv import load_dotenv
from app.models import users
from app.database import database

load_dotenv()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def create_access_token(data: dict):
    return jwt.encode(data, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        if username is None or user_id is None:
            raise credentials_exception
        query = users.select().where(users.c.id == user_id)
        user_record = await database.fetch_one(query)
        
        if not user_record:
            raise credentials_exception
        
        return {
            "username": username,
            "user_id": user_id,
            "role": user_record["role"],    
        }
        
    except JWTError:
        raise credentials_exception