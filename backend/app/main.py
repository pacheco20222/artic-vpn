import os
from dotenv import load_dotenv
from fastapi import FastAPI
from app.database import database
from app.routes import user_routes, server_routes, security_routes, agent_routes
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],  # your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(user_routes.router, prefix="/users", tags=["users"])
app.include_router(server_routes.router)
app.include_router(agent_routes.router)
app.include_router(security_routes.router, prefix="/security", tags=["security"])

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()