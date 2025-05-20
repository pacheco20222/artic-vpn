from fastapi import FastAPI
from app.database import database
from app.routes import user_routes, server_routes, security_routes

app = FastAPI()
app.include_router(user_routes.router)
app.include_router(server_routes.router)
app.include_router(security_routes.router)

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()