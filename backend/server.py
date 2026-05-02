"""Casa de Poker - Backend API (Refactored)
FastAPI + MongoDB (motor). Modular architecture.
"""
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware

from auth_utils import db, client, get_current_user, require_admin, iso, now_utc, gen_id
from routers import auth, players, tournaments, cashier, cash_tables, dealers, ranking, dashboard, point_structures, bar, users

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

app = FastAPI(title="Casa de Poker API", version="1.1.0")
api = APIRouter(prefix="/api")

@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.players.create_index("id", unique=True)
    await db.players.create_index("name")
    await db.tournaments.create_index("id", unique=True)
    await db.login_attempts.create_index("created_at", expireAfterSeconds=1800)
    await db.products.create_index("id", unique=True)
    await db.sales.create_index("id", unique=True)
    await db.sales.create_index("created_at")
    
    # Default admin if none
    if await db.users.count_documents({}) == 0:
        from auth_utils import hash_password
        await db.users.insert_one({
            "id": gen_id(),
            "email": "admin@poker.com",
            "password_hash": hash_password("admin123"),
            "name": "Administrador",
            "role": "admin",
            "created_at": iso(now_utc())
        })

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

@api.get("/config")
async def get_public_config():
    return {"house_name": os.environ.get("HOUSE_NAME", "Casa de Poker")}

# ---------- Mount Routers ----------
api.include_router(auth.router)
api.include_router(players.router)
api.include_router(tournaments.router)
api.include_router(cashier.router)
api.include_router(cash_tables.router)
api.include_router(dealers.router)
api.include_router(ranking.router)
api.include_router(dashboard.router)
api.include_router(point_structures.router)
api.include_router(bar.router)
api.include_router(users.router)
app.include_router(api)

# ---------- CORS ----------
_cors = os.environ.get("CORS_ORIGINS", "").strip()
if _cors and _cors != "*":
    _origins = [o.strip() for o in _cors.split(",") if o.strip()]
else:
    _frontend = os.environ.get("FRONTEND_URL", "").strip()
    _origins = [_frontend] if (_frontend and _frontend != "*") else ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
