from sqlalchemy import Table, Column, Integer, String, Boolean, DateTime, ForeignKey
from .database import metadata
import datetime

users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("username", String(100), unique=True, nullable=False),
    Column("email", String(150), unique=True, nullable=False),
    Column("hashed_password", String(255), nullable=False),
    Column("is_active", Boolean, default=True),
    Column("created_at", DateTime, default=datetime.datetime.utcnow)
)

twofa_secrets = Table(
    "2fa_secrets",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
    Column("secret_key", String(255), nullable=False),
    Column("created_at", DateTime, default=datetime.datetime.utcnow)
)

vpn_servers = Table(
    "vpn_servers",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(100), nullable=False),
    Column("country", String(50)),
    Column("ip_address", String(100), nullable=False),
    Column("config_path", String(255)),
    Column("is_active", Boolean, default=True)
)

connections = Table(
    "connections",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id")),
    Column("server_id", Integer, ForeignKey("vpn_servers.id")),
    Column("connected_at", DateTime, default=datetime.datetime.utcnow),
    Column("disconnected_at", DateTime, nullable=True)
)
