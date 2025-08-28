from sqlalchemy import Table, Column, Integer, String, Boolean, DateTime, ForeignKey, text, UniqueConstraint, Index
from sqlalchemy.sql import func
from .database import metadata

users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("username", String(100), unique=True, nullable=False),
    Column("email", String(150), unique=True, nullable=False),
    Column("hashed_password", String(255), nullable=False),
    Column("is_active", Boolean, server_default=text("1")),
    Column("created_at", DateTime, server_default=func.now()),
)

twofa_secrets = Table(
    "2fa_secrets",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id")),
    Column("secret_key", String(255), nullable=False),
    Column("created_at", DateTime, server_default=func.now()),
)

vpn_servers = Table(
    "vpn_servers",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(100), nullable=False),
    Column("country", String(50)),
    Column("ip_address", String(100), nullable=False),
    Column("config_path", String(255)),  # path to OpenVPN/WireGuard config file
    Column("is_active", Boolean, server_default=text("1")),
    Column("wg_public_key", String(64), nullable=True),
    Column("wg_endpoint", String(255), nullable=True),
    Column("wg_allowed_ips", String(255), nullable=True),
    Column("wg_dns", String(255), nullable=True),
)

# New table for WireGuard allocations
wg_allocations = Table(
    "wg_allocations",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("users.id"), nullable=False),
    Column("server_id", Integer, ForeignKey("vpn_servers.id"), nullable=False),
    Column("client_ip", String(32), nullable=False),  # e.g. "10.8.0.10/32"
    Column("client_public_key", String(64), nullable=False),
    Column("created_at", DateTime, server_default=func.now()),
    Column("revoked_at", DateTime, nullable=True),
    UniqueConstraint("server_id", "client_ip", name="uq_wg_alloc_server_ip"),
    Index("idx_wg_alloc_user", "user_id"),
    Index("idx_wg_alloc_server", "server_id"),
)

connections = Table(
    "connections",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id")),
    Column("server_id", Integer, ForeignKey("vpn_servers.id")),
    Column("connected_at", DateTime, server_default=func.now()),
    Column("disconnected_at", DateTime, nullable=True),
)


recovery_codes = Table(
    "recovery_codes",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("users.id"), nullable=False, index=True),
    Column("code_hash", String(255), nullable=False),         
    Column("used_at", DateTime, nullable=True),
    Column("created_at", DateTime, server_default=func.now()),
)