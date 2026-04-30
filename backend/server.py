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
from decimal import Decimal

from auth_utils import db, client, get_current_user, require_admin, iso, now_utc, gen_id
from routers import auth, players, tournaments, cashier, cash_tables, dealers, ranking

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

@api.get("/dashboard/summary")
async def dashboard_summary(_: dict = Depends(get_current_user)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = iso(today_start)
    
    # 1. Tournament Rake
    entries_today = await db.entries.find({"created_at": {"$gte": today_iso}}, {"_id": 0, "tournament_id": 1}).to_list(10000)
    t_ids = list(set(e["tournament_id"] for e in entries_today))
    tournaments = await db.tournaments.find({"id": {"$in": t_ids}}, {"id": 1, "rake": 1}).to_list(1000)
    rake_map = {t["id"]: Decimal(str(t.get("rake", 0))) for t in tournaments}
    tour_rake = sum(rake_map.get(e["tournament_id"], Decimal(0)) for e in entries_today)
    
    # 2. Cash Rake + Manual adjustments
    txs_today = await db.transactions.find({"created_at": {"$gte": today_iso}}, {"_id": 0}).to_list(5000)
    cash_rake = Decimal(0)
    manual_adj = Decimal(0)
    for t in txs_today:
        ttype = t.get("type")
        desc = t.get("description", "")
        amt = Decimal(str(t.get("amount", 0)))
        if ttype == "income" and "Rake" in desc:
            cash_rake += amt
        elif ttype == "manual_in":
            manual_adj += amt
        elif ttype == "manual_out" or ttype == "expense":
            manual_adj -= amt
            
    revenue_today = tour_rake + cash_rake + manual_adj
    
    open_tables = await db.cash_tables.count_documents({"status": "open"})
    ongoing_tournaments = await db.tournaments.count_documents({"status": "in_progress"})
    
    # Active players count
    in_prog = await db.tournaments.find({"status": "in_progress"}, {"id": 1}).to_list(100)
    in_prog_ids = [t["id"] for t in in_prog]
    active_players_set = set()
    if in_prog_ids:
        active_entries = await db.entries.find({"tournament_id": {"$in": in_prog_ids}, "status": "active"}).to_list(2000)
        for e in active_entries: active_players_set.add(e["player_id"])
    
    seated_count = 0
    open_tables_docs = await db.cash_tables.find({"status": "open"}).to_list(100)
    for tt in open_tables_docs: seated_count += int(tt.get("seated_count", 0))
    
    total_players = await db.players.count_documents({})
    
    return {
        "revenue_today": float(revenue_today),
        "open_tables": open_tables,
        "ongoing_tournaments": ongoing_tournaments,
        "active_players": len(active_players_set) + seated_count,
        "total_players": total_players
    }

# ---------- Mount Routers ----------
api.include_router(auth.router)
api.include_router(players.router)
api.include_router(tournaments.router)
api.include_router(cashier.router)
api.include_router(cash_tables.router)
api.include_router(dealers.router)
api.include_router(ranking.router)
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
