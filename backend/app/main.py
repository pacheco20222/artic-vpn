from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.database import database
from app.models import users
import bcrypt
import os
from dotenv import load_dotenv
from jose import jwt

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    
class UserLogin(BaseModel):
    username: str
    password: str


load_dotenv()
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM")
app = FastAPI()

@app.on_event("startup")
async def connect_to_db():
    await database.connect()
    
@app.on_event("shutdown")
async def disconnect_from_db():
    await database.disconnect()

@app.get("/")
def read_root():
    return {"message" : "Welcome to Artic VPN"}

@app.post("/register")
async def register_user(user: UserCreate):
    # Check if user already exists by username or email
    query = users.select().where((users.c.username == user.username) | (users.c.email == user.email))
    existing_user = await database.fetch_one(query)

    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    # Hash the password
    hashed_pw = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())

    # Insert the user into the database
    insert_query = users.insert().values(
        username=user.username,
        email=user.email,
        hashed_password=hashed_pw.decode('utf-8')  # decode to store as string
    )
    await database.execute(insert_query)

    return {"message": f"User {user.username} registered successfully"}

@app.post("/login")
async def login_user(user: UserLogin):
    # Fetch user by username
    query = users.select().where(users.c.username == user.username)
    db_user = await database.fetch_one(query)

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid username or password")

    # Check password
    stored_hash = db_user["hashed_password"]
    if not bcrypt.checkpw(user.password.encode("utf-8"), stored_hash.encode("utf-8")):
        raise HTTPException(status_code=400, detail="Invalid username or password")

    payload = {
        "sub": user.username,
        "user_id": db_user["id"]
    }
    
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}
