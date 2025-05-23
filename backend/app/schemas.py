from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str
    twofa_code: str | None = None # Optional for 2FA
    
class VPNServerCreate(BaseModel):
    name: str
    country: str
    ip_address: str
    config_path: str
    is_active: bool = True

class VPNServerUpdate(BaseModel):
    name: str | None = None
    country: str | None = None
    ip_address: str | None = None
    config_path: str | None = None
    is_active: bool | None = None
    
class TwoFAVerify(BaseModel):
    code: str
    
class MyConnection(BaseModel):
    server_name: str
    country: str
    connected_at: datetime
    disconnected_at: Optional[datetime]