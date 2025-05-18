from fastapi import FastAPI
from app.database import database
from app.routes import user_routes
from app.schemas import UserCreate, UserLogin

app = FastAPI()

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()
    
app.include_router(user_routes.router)