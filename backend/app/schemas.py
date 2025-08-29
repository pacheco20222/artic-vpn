from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel

# --- Auth / Users ---

class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str
    twofa_code: Optional[str] = None  # Optional for 2FA


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    # Pydantic v2: from_attributes=True; if you're on v1, use: class Config: orm_mode = True
    model_config = {"from_attributes": True}


# --- VPN Servers ---

class VPNServerCreate(BaseModel):
    name: str
    country: str
    ip_address: str
    config_path: str
    is_active: bool = True


class VPNServerUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    ip_address: Optional[str] = None
    config_path: Optional[str] = None
    is_active: Optional[bool] = None


class VPNServerOut(BaseModel):
    id: int
    name: str
    country: Optional[str]
    ip_address: str
    is_active: bool

    model_config = {"from_attributes": True}


# --- 2FA ---

class TwoFAVerify(BaseModel):
    code: str


# --- Connections ---

class ConnectRequest(BaseModel):
    user_id: int
    server_id: int
    public_key: str
    client_ip: str


class DisconnectRequest(BaseModel):
    user_id: int


class ConnectionOut(BaseModel):
    id: int
    user_id: int
    server_id: int
    connected_at: datetime
    disconnected_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MyConnection(BaseModel):
    server_name: str
    country: Optional[str]
    connected_at: datetime
    disconnected_at: Optional[datetime] = None


class MyConnectionsResponse(BaseModel):
    connections: List[MyConnection]


# --- WireGuard Config ---

class WGConfigResponse(BaseModel):
    config_text: str         # full client .conf file text
    qr_code_data_url: str    # data:image/png;base64,... string
    allocated_ip: str        # IP assigned to the client

class WGConfigResponse(BaseModel):
    config_text: str
    qr_code_data_url: str
    allocated_ip: str