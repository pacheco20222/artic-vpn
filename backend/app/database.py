import os
from sqlalchemy import create_engine, MetaData
from databases import Database
from dotenv import load_dotenv
from urllib.parse import quote_plus

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

# Safely encode the password for use in the URL
SAFE_DB_PASSWORD = quote_plus(DB_PASSWORD or "")

DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{SAFE_DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
SYNC_DATABASE_URL = f"mysql+pymysql://{DB_USER}:{SAFE_DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

database = Database(DATABASE_URL)
metadata = MetaData()

engine = create_engine(SYNC_DATABASE_URL)