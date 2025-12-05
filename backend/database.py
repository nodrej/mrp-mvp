from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from datetime import datetime
import pytz

# Configure MST timezone
MST_TIMEZONE = pytz.timezone('America/Denver')  # MST/MDT as appropriate

def get_mst_now():
    """Get current time in MST timezone"""
    return datetime.now(MST_TIMEZONE)

# SQLite database file location
# Use environment variable if set (for Docker), otherwise use relative path
DATABASE_PATH_ENV = os.getenv("DATABASE_PATH")
if DATABASE_PATH_ENV:
    DB_PATH = DATABASE_PATH_ENV
    print(f"Using database from environment: {DB_PATH}")
else:
    # Get the project root directory (one level up from backend)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(BASE_DIR, "data", "mrp.db")
    print(f"Using database from relative path: {DB_PATH}")

DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite
    echo=True  # Log SQL queries (disable in production)
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize database
def init_db():
    """Create all tables"""
    import os

    # Debug information
    print(f"\n=== Database Initialization ===")
    print(f"Database URL: {DATABASE_URL}")
    print(f"Database Path: {DB_PATH}")
    print(f"Database file exists: {os.path.exists(DB_PATH)}")
    if os.path.exists(DB_PATH):
        print(f"Database file size: {os.path.getsize(DB_PATH)} bytes")
        print(f"Database file permissions: {oct(os.stat(DB_PATH).st_mode)[-3:]}")

    # Get the directory of the database file
    db_dir = os.path.dirname(DB_PATH)
    print(f"Database directory: {db_dir}")
    print(f"Database directory exists: {os.path.exists(db_dir)}")
    if os.path.exists(db_dir):
        print(f"Database directory permissions: {oct(os.stat(db_dir).st_mode)[-3:]}")
        print(f"Database directory contents: {os.listdir(db_dir)}")
    print(f"================================\n")

    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully!")
