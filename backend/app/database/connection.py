"""SQLite connection management. Uses Python stdlib sqlite3 — zero new dependencies."""

import sqlite3
import os
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DB_PATH = DB_DIR / "calculator.db"


def get_db_path() -> str:
    """Return the database file path, creating the directory if needed."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    return str(DB_PATH)


def get_connection() -> sqlite3.Connection:
    """Get a new SQLite connection with WAL mode and foreign keys enabled."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize database schema from schema.sql."""
    conn = get_connection()
    schema_path = Path(__file__).parent / "schema.sql"
    with open(schema_path) as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()


def dict_from_row(row: sqlite3.Row | None) -> dict | None:
    """Convert a sqlite3.Row to a dict."""
    if row is None:
        return None
    return dict(row)
