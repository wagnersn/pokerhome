"""Casa de Poker - Backend API
FastAPI + MongoDB (motor). Single-file server for clarity.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal, Dict, Any

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, Query, Body
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 8  # 8h shift

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("poker")


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ---------- Models ----------
class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Literal["admin", "operator"]
    created_at: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "operator"] = "operator"


class PlayerIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class PlayerOut(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    debt_balance: float = 0.0
    created_at: str


class PointRule(BaseModel):
    position: int
    points: float


class PointStructureIn(BaseModel):
    name: str
    rules: List[PointRule]


class PointStructureOut(BaseModel):
    id: str
    name: str
    rules: List[PointRule]
    created_at: str


class TournamentIn(BaseModel):
    name: str
    type: str  # e.g. "NLHE Daily", "Omaha", "High Roller"
    start_at: str  # ISO datetime
    is_freeroll: bool = False
    buy_in: float = 0
    rake: float = 0
    double_buyin: float = 0
    rebuy: float = 0
    double_rebuy: float = 0
    addon_simple: float = 0
    super_addon: float = 0
    bonus: float = 0
    # Fichas por ação (controle de chips em jogo)
    chips_buy_in: int = 0
    chips_double_buyin: int = 0
    chips_rebuy: int = 0
    chips_double_rebuy: int = 0
    chips_addon: int = 0
    chips_super_addon: int = 0
    chips_bonus: int = 0
    point_structure_id: Optional[str] = None
    notes: Optional[str] = None


class TournamentOut(TournamentIn):
    id: str
    status: Literal["scheduled", "in_progress", "finished"] = "scheduled"
    created_at: str
    prize_distribution: Optional[List[Dict[str, Any]]] = None  # [{position, percent, amount}]


class EntryOut(BaseModel):
    id: str
    tournament_id: str
    player_id: str
    player_name: str
    entry_type: Literal["simple", "double"] = "simple"
    rebuys: int = 0
    double_rebuys: int = 0
    addons_simple: int = 0
    super_addons: int = 0
    bonus: bool = False
    total_chips: int = 0
    current_chips: int = 0
    eliminated_at: Optional[str] = None
    final_position: Optional[int] = None
    points: float = 0
    total_spent: float = 0
    paid_amount: float = 0
    pending_amount: float = 0
    debt_amount: float = 0
    status: Literal["active", "eliminated", "finalized"] = "active"
    created_at: str


class ChargeOut(BaseModel):
    id: str
    entry_id: Optional[str]
    tournament_id: Optional[str]
    player_id: Optional[str]
    player_name: Optional[str]
    type: str
    amount: float
    payment_status: Literal["pending", "paid", "on_debt"] = "pending"
    payment_method: Optional[str] = None
    description: Optional[str] = None
    tournament_name: Optional[str] = None
    created_at: str


class CashTableIn(BaseModel):
    name: str
    game_type: str  # texas_holdem, omaha, ...
    small_blind: float
    big_blind: float
    max_seats: int = 9
    bb_on_button: bool = False
    rake_percent: float = 0.0
    rake_cap: float = 0.0
    jackpot_percent: float = 0.0
    jackpot_cap: float = 0.0


class CashTableOut(CashTableIn):
    id: str
    status: Literal["open", "closed"] = "closed"
    seated_count: int = 0
    opened_at: Optional[str] = None
    closed_at: Optional[str] = None
    created_at: str


class WaitlistEntryOut(BaseModel):
    id: str
    table_id: str
    player_id: str
    player_name: str
    position: int
    status: Literal["waiting", "called", "seated", "cancelled"] = "waiting"
    created_at: str


class TransactionIn(BaseModel):
    type: Literal["cash_chip_sale", "debt_payment", "manual_in", "manual_out"]
    player_id: Optional[str] = None
    table_id: Optional[str] = None
    amount: float
    payment_method: Literal["cash", "pix", "card", "debt"] = "cash"
    description: Optional[str] = None


class PrizeDistributionItem(BaseModel):
    position: int
    percent: float


class PrizeDistributionIn(BaseModel):
    distribution: List[PrizeDistributionItem]


# ---------- Auth dependency ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user


# ---------- App / router ----------
app = FastAPI(title="Casa de Poker API", version="1.0.0")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.players.create_index("id", unique=True)
    await db.players.create_index("name")
    await db.tournaments.create_index("id", unique=True)
    await db.tournaments.create_index("start_at")
    await db.entries.create_index("id", unique=True)
    await db.entries.create_index([("tournament_id", 1), ("player_id", 1)])
    await db.charges.create_index("id", unique=True)
    await db.charges.create_index([("entry_id", 1)])
    await db.charges.create_index([("payment_status", 1)])
    await db.transactions.create_index("id", unique=True)
    await db.transactions.create_index("created_at")
    await db.cash_tables.create_index("id", unique=True)
    await db.waitlist.create_index("id", unique=True)
    await db.point_structures.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")

    # Seed admin + operator
    seeds = [
        (os.environ.get("ADMIN_EMAIL", "admin@poker.com"), os.environ.get("ADMIN_PASSWORD", "admin123"), "Administrador", "admin"),
        (os.environ.get("OPERATOR_EMAIL", "caixa@poker.com"), os.environ.get("OPERATOR_PASSWORD", "caixa123"), "Operador de Caixa", "operator"),
    ]
    for email, pw, name, role in seeds:
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "id": gen_id(),
                "email": email,
                "password_hash": hash_password(pw),
                "name": name,
                "role": role,
                "created_at": iso(now_utc()),
            })
            logger.info(f"Seeded user {email}")
        elif not verify_password(pw, existing.get("password_hash", "")):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pw)}})
            logger.info(f"Updated password for {email}")

    # Seed default point structure
    if not await db.point_structures.find_one({"name": "Padrão (Top 9)"}):
        default_rules = [
            {"position": 1, "points": 100},
            {"position": 2, "points": 80},
            {"position": 3, "points": 65},
            {"position": 4, "points": 50},
            {"position": 5, "points": 40},
            {"position": 6, "points": 32},
            {"position": 7, "points": 25},
            {"position": 8, "points": 20},
            {"position": 9, "points": 15},
        ]
        await db.point_structures.insert_one({
            "id": gen_id(),
            "name": "Padrão (Top 9)",
            "rules": default_rules,
            "created_at": iso(now_utc()),
        })


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
    
@api.get("/config")
async def get_public_config():
    return {
        "house_name": os.environ.get("HOUSE_NAME", "Casa de Poker"),
    }



# ---------- Auth endpoints ----------
def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )


@api.post("/auth/login")
async def login(body: LoginIn, response: Response, request: Request):
    email = body.email.lower().strip()
    # Behind ingress, request.client.host rotates; key the throttle by email (stable).
    identifier = f"email:{email}"

    # Brute force: 5 attempts in 15 min
    cutoff = now_utc() - timedelta(minutes=15)
    attempts = await db.login_attempts.count_documents({
        "identifier": identifier,
        "created_at": {"$gte": iso(cutoff)},
    })
    if attempts >= 5:
        raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em 15 minutos.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        await db.login_attempts.insert_one({"identifier": identifier, "created_at": iso(now_utc())})
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

    await db.login_attempts.delete_many({"identifier": identifier})
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "token": token,
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(
        id=user["id"], email=user["email"], name=user["name"],
        role=user["role"], created_at=user.get("created_at", iso(now_utc())),
    )


# ---------- Users (admin) ----------
@api.get("/users", response_model=List[UserOut])
async def list_users(_: dict = Depends(require_admin)):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return [UserOut(**d) for d in docs]


@api.post("/users", response_model=UserOut)
async def create_user(body: UserCreateIn, _: dict = Depends(require_admin)):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    doc = {
        "id": gen_id(),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    return UserOut(id=doc["id"], email=doc["email"], name=doc["name"], role=doc["role"], created_at=doc["created_at"])


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, current: dict = Depends(require_admin)):
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Você não pode remover a si mesmo")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"ok": True}


# ---------- Players ----------
@api.get("/players", response_model=List[PlayerOut])
async def list_players(q: Optional[str] = None, _: dict = Depends(get_current_user)):
    query = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.players.find(query, {"_id": 0}).sort("name", 1).to_list(2000)
    return [PlayerOut(**d) for d in docs]


@api.post("/players", response_model=PlayerOut)
async def create_player(body: PlayerIn, _: dict = Depends(get_current_user)):
    doc = {
        "id": gen_id(),
        **body.model_dump(),
        "debt_balance": 0.0,
        "created_at": iso(now_utc()),
    }
    await db.players.insert_one(doc)
    doc.pop("_id", None)
    return PlayerOut(**doc)


@api.get("/players/{player_id}", response_model=PlayerOut)
async def get_player(player_id: str, _: dict = Depends(get_current_user)):
    p = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Jogador não encontrado")
    return PlayerOut(**p)


@api.put("/players/{player_id}", response_model=PlayerOut)
async def update_player(player_id: str, body: PlayerIn, _: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    res = await db.players.update_one({"id": player_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Jogador não encontrado")
    p = await db.players.find_one({"id": player_id}, {"_id": 0})
    return PlayerOut(**p)


@api.delete("/players/{player_id}")
async def delete_player(player_id: str, _: dict = Depends(require_admin)):
    res = await db.players.delete_one({"id": player_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Jogador não encontrado")
    return {"ok": True}


@api.get("/players/{player_id}/profile")
async def player_profile(player_id: str, _: dict = Depends(get_current_user)):
    p = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Jogador não encontrado")
    entries = await db.entries.find({"player_id": player_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # enrich with tournament names + prize
    enriched = []
    total_spent = 0.0
    total_won = 0.0
    total_points = 0.0
    for e in entries:
        t = await db.tournaments.find_one({"id": e["tournament_id"]}, {"_id": 0})
        prize = 0.0
        if t and t.get("prize_distribution") and e.get("final_position"):
            for item in t["prize_distribution"]:
                if item.get("position") == e["final_position"]:
                    prize = float(item.get("amount", 0))
                    break
        e["tournament_name"] = t["name"] if t else "—"
        e["tournament_type"] = t["type"] if t else "—"
        e["prize"] = prize
        total_spent += float(e.get("total_spent", 0))
        total_won += prize
        total_points += float(e.get("points", 0))
        enriched.append(e)
    # Add Cash Sessions
    sessions = await db.waitlist.find({"player_id": player_id, "status": "finished"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    total_cash_buyin = 0.0
    total_cash_cashout = 0.0
    for s in sessions:
        session_charges = await db.charges.find({"session_id": s["id"]}).to_list(100)
        buyin = sum(float(c.get("amount", 0)) for c in session_charges if c["type"] == "cash_buyin")
        cashout = sum(float(c.get("amount", 0)) for c in session_charges if c["type"] == "cash_cashout")
        s["buyin"] = buyin
        s["cashout"] = cashout
        s["result"] = cashout - buyin
        total_cash_buyin += buyin
        total_cash_cashout += cashout
        table = await db.cash_tables.find_one({"id": s["table_id"]}, {"_id": 0, "name": 1})
        s["table_name"] = table["name"] if table else "—"

    transactions = await db.transactions.find({"player_id": player_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {
        "player": p,
        "entries": enriched,
        "cash_sessions": sessions,
        "transactions": transactions,
        "stats": {
            "total_entries": len(entries),
            "total_spent": round(total_spent + total_cash_buyin, 2),
            "total_won": round(total_won + total_cash_cashout, 2),
            "roi": round((total_won + total_cash_cashout) - (total_spent + total_cash_buyin), 2),
            "total_points": round(total_points, 2),
            "debt_balance": p.get("debt_balance", 0),
        },
    }


# ---------- Point Structures ----------
@api.get("/point-structures", response_model=List[PointStructureOut])
async def list_point_structures(_: dict = Depends(get_current_user)):
    docs = await db.point_structures.find({}, {"_id": 0}).to_list(200)
    return [PointStructureOut(**d) for d in docs]


@api.post("/point-structures", response_model=PointStructureOut)
async def create_point_structure(body: PointStructureIn, _: dict = Depends(require_admin)):
    doc = {"id": gen_id(), **body.model_dump(), "created_at": iso(now_utc())}
    await db.point_structures.insert_one(doc)
    doc.pop("_id", None)
    return PointStructureOut(**doc)


@api.put("/point-structures/{ps_id}", response_model=PointStructureOut)
async def update_point_structure(ps_id: str, body: PointStructureIn, _: dict = Depends(require_admin)):
    res = await db.point_structures.update_one({"id": ps_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Estrutura não encontrada")
    d = await db.point_structures.find_one({"id": ps_id}, {"_id": 0})
    return PointStructureOut(**d)


@api.delete("/point-structures/{ps_id}")
async def delete_point_structure(ps_id: str, _: dict = Depends(require_admin)):
    await db.point_structures.delete_one({"id": ps_id})
    return {"ok": True}


# ---------- Tournaments ----------
@api.get("/tournaments", response_model=List[TournamentOut])
async def list_tournaments(status: Optional[str] = None, _: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    docs = await db.tournaments.find(query, {"_id": 0}).sort("start_at", -1).to_list(1000)
    return [TournamentOut(**d) for d in docs]


@api.post("/tournaments", response_model=TournamentOut)
async def create_tournament(body: TournamentIn, _: dict = Depends(require_admin)):
    doc = {
        "id": gen_id(),
        **body.model_dump(),
        "status": "scheduled",
        "prize_distribution": None,
        "created_at": iso(now_utc()),
    }
    await db.tournaments.insert_one(doc)
    doc.pop("_id", None)
    return TournamentOut(**doc)


@api.get("/tournaments/{tid}", response_model=TournamentOut)
async def get_tournament(tid: str, _: dict = Depends(get_current_user)):
    t = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneio não encontrado")
    return TournamentOut(**t)


@api.put("/tournaments/{tid}", response_model=TournamentOut)
async def update_tournament(tid: str, body: TournamentIn, _: dict = Depends(require_admin)):
    res = await db.tournaments.update_one({"id": tid}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Torneio não encontrado")
    t = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    return TournamentOut(**t)


@api.post("/tournaments/{tid}/status")
async def update_tournament_status(tid: str, status: str = Query(...), _: dict = Depends(require_admin)):
    if status not in ("scheduled", "in_progress", "finished"):
        raise HTTPException(400, "Status inválido")
    await db.tournaments.update_one({"id": tid}, {"$set": {"status": status}})
    return {"ok": True}


@api.delete("/tournaments/{tid}")
async def delete_tournament(tid: str, _: dict = Depends(require_admin)):
    await db.entries.delete_many({"tournament_id": tid})
    await db.tournaments.delete_one({"id": tid})
    return {"ok": True}


async def _recalc_entry(entry_id: str):
    """Recalculate financial totals and total_chips for an entry."""
    e = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not e:
        return None
    charges = await db.charges.find({"entry_id": entry_id}, {"_id": 0}).to_list(500)
    total = sum(c["amount"] for c in charges)
    paid = sum(c["amount"] for c in charges if c["payment_status"] == "paid")
    debt = sum(c["amount"] for c in charges if c["payment_status"] == "on_debt")
    pending = sum(c["amount"] for c in charges if c["payment_status"] == "pending")
    # Chips count
    t = await db.tournaments.find_one({"id": e["tournament_id"]}, {"_id": 0})
    chips = 0
    if t:
        # Initial chips depend on entry type
        if e.get("entry_type") == "double":
            chips += int(t.get("chips_double_buyin", 0))
        else:
            chips += int(t.get("chips_buy_in", 0))
        chips += int(e.get("rebuys", 0)) * int(t.get("chips_rebuy", 0))
        chips += int(e.get("double_rebuys", 0)) * int(t.get("chips_double_rebuy", 0))
        chips += int(e.get("addons_simple", 0)) * int(t.get("chips_addon", 0))
        chips += int(e.get("super_addons", 0)) * int(t.get("chips_super_addon", 0))
        if e.get("bonus"):
            chips += int(t.get("chips_bonus", 0))
    await db.entries.update_one(
        {"id": entry_id},
        {"$set": {
            "total_spent": round(total, 2),
            "paid_amount": round(paid, 2),
            "debt_amount": round(debt, 2),
            "pending_amount": round(pending, 2),
            "total_chips": chips,
        }},
    )


async def _create_charge(entry: dict, ctype: str, amount: float, description: str = ""):
    if amount <= 0:
        return
    doc = {
        "id": gen_id(),
        "entry_id": entry["id"],
        "tournament_id": entry["tournament_id"],
        "player_id": entry["player_id"],
        "player_name": entry.get("player_name"),
        "type": ctype,
        "amount": float(amount),
        "payment_status": "pending",
        "payment_method": None,
        "description": description,
        "created_at": iso(now_utc()),
    }
    await db.charges.insert_one(doc)


# ---------- Entries ----------
@api.get("/tournaments/{tid}/entries", response_model=List[EntryOut])
async def list_entries(tid: str, _: dict = Depends(get_current_user)):
    docs = await db.entries.find({"tournament_id": tid}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [EntryOut(**d) for d in docs]


@api.post("/tournaments/{tid}/entries", response_model=EntryOut)
async def create_entry(
    tid: str,
    player_id: str = Query(...),
    entry_type: Literal["simple", "double"] = Query("simple"),
    allow_debt: bool = Query(False),
    _: dict = Depends(get_current_user),
):
    t = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneio não encontrado")
    p = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Jogador não encontrado")
    if p.get("debt_balance", 0) > 0 and not allow_debt:
        raise HTTPException(409, f"Jogador possui dívida pendente de R$ {p['debt_balance']:.2f}. Confirme para continuar.")
    if await db.entries.find_one({"tournament_id": tid, "player_id": player_id}):
        raise HTTPException(400, "Jogador já inscrito neste torneio")

    is_freeroll = bool(t.get("is_freeroll"))
    initial_chips = int(t.get("chips_double_buyin" if entry_type == "double" else "chips_buy_in", 0))

    entry = {
        "id": gen_id(),
        "tournament_id": tid,
        "player_id": player_id,
        "player_name": p["name"],
        "entry_type": entry_type,
        "rebuys": 0,
        "double_rebuys": 0,
        "addons_simple": 0,
        "super_addons": 0,
        "bonus": False,
        "total_chips": initial_chips,
        "current_chips": initial_chips,
        "eliminated_at": None,
        "final_position": None,
        "points": 0,
        "total_spent": 0,
        "paid_amount": 0,
        "pending_amount": 0,
        "debt_amount": 0,
        "status": "active",
        "created_at": iso(now_utc()),
    }
    await db.entries.insert_one(entry)
    # Buy-in charge (skip if freeroll). Rake is charged ONCE here regardless of entry type.
    if not is_freeroll:
        buyin_value = float(t.get("double_buyin" if entry_type == "double" else "buy_in", 0))
        rake_value = float(t.get("rake", 0))
        total = buyin_value + rake_value
        if total > 0:
            label = "Entrada dupla" if entry_type == "double" else "Buy-in"
            await _create_charge(entry, "buyin", total, f"{label}: {t['name']}")
    await _recalc_entry(entry["id"])
    e = await db.entries.find_one({"id": entry["id"]}, {"_id": 0})
    return EntryOut(**e)


@api.post("/entries/{entry_id}/action")
async def entry_action(entry_id: str, action: str = Query(...), _: dict = Depends(get_current_user)):
    """action ∈ rebuy | double_rebuy | addon | super_addon | bonus | double_entry"""
    e = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Inscrição não encontrada")
    t = await db.tournaments.find_one({"id": e["tournament_id"]}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneio não encontrado")
    if e.get("status") == "eliminated":
        raise HTTPException(400, "Jogador eliminado — reinscreva ou re-entry")

    chips_added = 0
    if action == "rebuy":
        await db.entries.update_one({"id": entry_id}, {"$inc": {"rebuys": 1}})
        await _create_charge(e, "rebuy", float(t.get("rebuy", 0)), "Rebuy")
        chips_added = int(t.get("chips_rebuy", 0))
    elif action == "double_rebuy":
        await db.entries.update_one({"id": entry_id}, {"$inc": {"double_rebuys": 1}})
        await _create_charge(e, "double_rebuy", float(t.get("double_rebuy", 0)), "Rebuy duplo")
        chips_added = int(t.get("chips_double_rebuy", 0))
    elif action == "double_entry":
        await db.entries.update_one({"id": entry_id}, {"$inc": {"double_entries": 1}})
        await _create_charge(e, "double_entry", float(t.get("double_buyin", 0)), "Entrada dupla")
        chips_added = int(t.get("chips_double_buyin", 0))
    elif action == "addon":
        await db.entries.update_one({"id": entry_id}, {"$inc": {"addons_simple": 1}})
        await _create_charge(e, "addon", float(t.get("addon_simple", 0)), "Add-on simples")
        chips_added = int(t.get("chips_addon", 0))
    elif action == "super_addon":
        await db.entries.update_one({"id": entry_id}, {"$inc": {"super_addons": 1}})
        await _create_charge(e, "super_addon", float(t.get("super_addon", 0)), "Super Add-on")
        chips_added = int(t.get("chips_super_addon", 0))
    elif action == "bonus":
        if e.get("bonus"):
            raise HTTPException(400, "Bônus já aplicado")
        await db.entries.update_one({"id": entry_id}, {"$set": {"bonus": True}})
        await _create_charge(e, "bonus", float(t.get("bonus", 0)), "Bônus / Staff")
        chips_added = int(t.get("chips_bonus", 0))
    else:
        raise HTTPException(400, "Ação inválida")

    if chips_added:
        await db.entries.update_one({"id": entry_id}, {"$inc": {"current_chips": chips_added}})
    await _recalc_entry(entry_id)
    return {"ok": True, "chips_added": chips_added}


@api.put("/entries/{entry_id}/chip-count")
async def update_chip_count(entry_id: str, count: int = Query(..., ge=0), _: dict = Depends(get_current_user)):
    """Atualiza a contagem atual de fichas do jogador (para uso em intervalos do torneio)."""
    res = await db.entries.update_one({"id": entry_id}, {"$set": {"current_chips": int(count)}})
    if res.matched_count == 0:
        raise HTTPException(404, "Inscrição não encontrada")
    return {"ok": True}


@api.post("/entries/{entry_id}/eliminate")
async def eliminate_entry(entry_id: str, _: dict = Depends(get_current_user)):
    """Marca o jogador como eliminado (zera stack atual; fichas migram para outros jogadores)."""
    e = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Inscrição não encontrada")
    await db.entries.update_one(
        {"id": entry_id},
        {"$set": {"status": "eliminated", "current_chips": 0, "eliminated_at": iso(now_utc())}},
    )
    return {"ok": True}


@api.post("/entries/{entry_id}/reactivate")
async def reactivate_entry(entry_id: str, _: dict = Depends(get_current_user)):
    """Reverte a eliminação (caso tenha sido marcado por engano)."""
    e = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Inscrição não encontrada")
    await db.entries.update_one(
        {"id": entry_id},
        {"$set": {"status": "active", "current_chips": int(e.get("total_chips", 0)), "eliminated_at": None}},
    )
    return {"ok": True}


@api.put("/entries/{entry_id}/position")
async def set_position(entry_id: str, position: int = Query(...), _: dict = Depends(get_current_user)):
    e = await db.entries.find_one({"id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Inscrição não encontrada")
    # compute points using tournament's point structure
    t = await db.tournaments.find_one({"id": e["tournament_id"]}, {"_id": 0})
    points = 0
    if t and t.get("point_structure_id"):
        ps = await db.point_structures.find_one({"id": t["point_structure_id"]}, {"_id": 0})
        if ps:
            for r in ps.get("rules", []):
                if r["position"] == position:
                    points = float(r["points"])
                    break
    await db.entries.update_one({"id": entry_id}, {"$set": {"final_position": position, "points": points, "status": "finalized", "current_chips": 0}})
    return {"ok": True, "points": points}


@api.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, _: dict = Depends(require_admin)):
    await db.charges.delete_many({"entry_id": entry_id})
    await db.entries.delete_one({"id": entry_id})
    return {"ok": True}


@api.get("/tournaments/{tid}/summary")
async def tournament_summary(tid: str, _: dict = Depends(get_current_user)):
    t = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneio não encontrado")
    entries = await db.entries.find({"tournament_id": tid}, {"_id": 0}).to_list(2000)
    charges = await db.charges.find({"tournament_id": tid}, {"_id": 0}).to_list(5000)

    total_entries = len(entries)
    simple_entries = sum(1 for e in entries if e.get("entry_type", "simple") == "simple")
    double_entries = sum(1 for e in entries if e.get("entry_type") == "double")
    total_rebuys = sum(e.get("rebuys", 0) for e in entries)
    total_double_rebuys = sum(e.get("double_rebuys", 0) for e in entries)
    total_addons = sum(e.get("addons_simple", 0) for e in entries)
    total_super = sum(e.get("super_addons", 0) for e in entries)
    total_bonus = sum(1 for e in entries if e.get("bonus"))
    total_chips = sum(e.get("total_chips", 0) for e in entries)
    active = [e for e in entries if e.get("status") == "active"]
    active_count = len(active)
    current_chips_total = sum(e.get("current_chips", 0) for e in active)
    avg_chips = (current_chips_total / active_count) if active_count else 0
    leaders = sorted(active, key=lambda e: int(e.get("current_chips", 0)), reverse=True)[:5]
    leaderboard = [
        {
            "entry_id": e["id"],
            "player_id": e["player_id"],
            "player_name": e.get("player_name"),
            "current_chips": int(e.get("current_chips", 0)),
        }
        for e in leaders
    ]

    gross = sum(c["amount"] for c in charges)
    rake_per_entry = float(t.get("rake", 0))
    # Rake é cobrado UMA VEZ por inscrição (no buy-in) — não recobrado em rebuys/addons.
    # Independe de ser entrada simples ou dupla.
    total_rake = 0.0 if t.get("is_freeroll") else rake_per_entry * total_entries
    prize_pool = max(0.0, gross - total_rake)

    paid = sum(c["amount"] for c in charges if c["payment_status"] == "paid")
    debt = sum(c["amount"] for c in charges if c["payment_status"] == "on_debt")
    pending = sum(c["amount"] for c in charges if c["payment_status"] == "pending")

    return {
        "tournament": t,
        "totals": {
            "entries": total_entries,
            "simple_entries": simple_entries,
            "double_entries": double_entries,
            "rebuys": total_rebuys,
            "double_rebuys": total_double_rebuys,
            "addons": total_addons,
            "super_addons": total_super,
            "bonus": total_bonus,
            "total_chips": total_chips,
            "current_chips_total": current_chips_total,
            "active_count": active_count,
            "average_chips": round(avg_chips),
            "gross": round(gross, 2),
            "rake": round(total_rake, 2),
            "prize_pool": round(prize_pool, 2),
            "paid": round(paid, 2),
            "debt": round(debt, 2),
            "pending": round(pending, 2),
        },
        "leaderboard": leaderboard,
        "prize_distribution": t.get("prize_distribution"),
    }


@api.put("/tournaments/{tid}/prize-distribution")
async def set_prize_distribution(tid: str, body: PrizeDistributionIn, _: dict = Depends(require_admin)):
    summary = await tournament_summary(tid)  # type: ignore
    pp = summary["totals"]["prize_pool"]
    dist = []
    for item in body.distribution:
        amount = round(pp * (item.percent / 100.0), 2)
        dist.append({"position": item.position, "percent": item.percent, "amount": amount})
    await db.tournaments.update_one({"id": tid}, {"$set": {"prize_distribution": dist}})
    return {"distribution": dist, "prize_pool": pp}


# ---------- Cashier ----------
@api.get("/cashier/pending")
async def cashier_pending(_: dict = Depends(get_current_user)):
    charges = await db.charges.find({"payment_status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    
    t_ids = list(set(c["tournament_id"] for c in charges if c.get("tournament_id")))
    tournaments = await db.tournaments.find({"id": {"$in": t_ids}}, {"id": 1, "name": 1}).to_list(2000)
    t_map = {t["id"]: t["name"] for t in tournaments}
    
    for c in charges:
        if c.get("tournament_id"):
            c["tournament_name"] = t_map.get(c["tournament_id"])
        else:
            c["tournament_name"] = "Cash Game"
            
    return charges


@api.get("/cashier/players/{player_id}/charges")
async def player_charges(player_id: str, _: dict = Depends(get_current_user)):
    # Retorna tanto pendentes quanto fiados para cobrança no caixa
    charges = await db.charges.find(
        {"player_id": player_id, "payment_status": {"$in": ["pending", "on_debt"]}}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    t_ids = list(set(c["tournament_id"] for c in charges if c.get("tournament_id")))
    tournaments = await db.tournaments.find({"id": {"$in": t_ids}}, {"id": 1, "name": 1}).to_list(500)
    t_map = {t["id"]: t["name"] for t in tournaments}
    
    for c in charges:
        if c.get("tournament_id"):
            c["tournament_name"] = t_map.get(c["tournament_id"])
        else:
            c["tournament_name"] = "Cash Game"
            
    return charges


@api.post("/cashier/charges/{charge_id}/pay")
async def pay_charge(charge_id: str, method: str = Query(...), _: dict = Depends(get_current_user)):
    if method not in ("cash", "pix", "card", "debt"):
        raise HTTPException(400, "Método inválido")
    c = await db.charges.find_one({"id": charge_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Cobrança não encontrada")
    if c["payment_status"] != "pending":
        raise HTTPException(400, "Cobrança já processada")
    new_status = "on_debt" if method == "debt" else "paid"
    await db.charges.update_one({"id": charge_id}, {"$set": {"payment_status": new_status, "payment_method": method, "settled_at": iso(now_utc())}})
    if method == "debt" and c.get("player_id"):
        await db.players.update_one({"id": c["player_id"]}, {"$inc": {"debt_balance": float(c["amount"])}})
        await db.transactions.insert_one({
            "id": gen_id(),
            "type": "debt_added",
            "player_id": c["player_id"],
            "amount": float(c["amount"]),
            "payment_method": "debt",
            "description": f"Dívida adicionada: {c.get('description', c['type'])}",
            "charge_id": charge_id,
            "created_at": iso(now_utc()),
        })
    else:
        await db.transactions.insert_one({
            "id": gen_id(),
            "type": "tournament_payment",
            "player_id": c.get("player_id"),
            "amount": float(c["amount"]),
            "payment_method": method,
            "description": c.get("description", c["type"]),
            "charge_id": charge_id,
            "created_at": iso(now_utc()),
        })
    if c.get("entry_id"):
        await _recalc_entry(c["entry_id"])
    return {"ok": True}


@api.post("/cashier/transactions")
async def create_transaction(body: TransactionIn, _: dict = Depends(get_current_user)):
    doc = {
        "id": gen_id(),
        **body.model_dump(),
        "created_at": iso(now_utc()),
    }
    await db.transactions.insert_one(doc)
    if body.type == "debt_payment" and body.player_id:
        # reduce player debt
        await db.players.update_one({"id": body.player_id}, {"$inc": {"debt_balance": -float(body.amount)}})
    doc.pop("_id", None)
    return doc


@api.get("/cashier/transactions")
async def list_transactions(limit: int = 200, _: dict = Depends(get_current_user)):
    docs = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api.get("/cashier/debtors")
async def list_debtors(_: dict = Depends(get_current_user)):
    docs = await db.players.find({"debt_balance": {"$gt": 0}}, {"_id": 0}).sort("debt_balance", -1).to_list(500)
    for d in docs:
        last_session = await db.waitlist.find_one({"player_id": d["id"], "status": "finished"}, sort=[("created_at", -1)])
        if last_session:
            session_charges = await db.charges.find({"session_id": last_session["id"]}).to_list(100)
            buyin = sum(float(c.get("amount", 0)) for c in session_charges if c["type"] == "cash_buyin")
            cashout = sum(float(c.get("amount", 0)) for c in session_charges if c["type"] == "cash_cashout")
            d["last_session_result"] = cashout - buyin
            d["last_session_buyin"] = buyin
            d["last_session_cashout"] = cashout
    return docs


# ---------- Cash Tables ----------
@api.get("/cash-tables", response_model=List[CashTableOut])
async def list_tables(_: dict = Depends(get_current_user)):
    docs = await db.cash_tables.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return [CashTableOut(**d) for d in docs]


@api.post("/cash-tables", response_model=CashTableOut)
async def create_table(body: CashTableIn, _: dict = Depends(require_admin)):
    doc = {
        "id": gen_id(),
        **body.model_dump(),
        "status": "closed",
        "seated_count": 0,
        "opened_at": None,
        "closed_at": None,
        "created_at": iso(now_utc()),
    }
    await db.cash_tables.insert_one(doc)
    doc.pop("_id", None)
    return CashTableOut(**doc)


@api.put("/cash-tables/{tid}", response_model=CashTableOut)
async def update_table(tid: str, body: CashTableIn, _: dict = Depends(require_admin)):
    await db.cash_tables.update_one({"id": tid}, {"$set": body.model_dump()})
    d = await db.cash_tables.find_one({"id": tid}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Mesa não encontrada")
    return CashTableOut(**d)


@api.post("/cash-tables/{tid}/open")
async def open_table(tid: str, _: dict = Depends(get_current_user)):
    await db.cash_tables.update_one({"id": tid}, {"$set": {"status": "open", "opened_at": iso(now_utc()), "closed_at": None}})
    return {"ok": True}


@api.post("/cash-tables/{tid}/close")
async def close_table(tid: str, payload: dict = Body(None), _: dict = Depends(require_admin)):
    payload = payload or {}
    rake = float(payload.get("rake", 0))
    jackpot = float(payload.get("jackpot", 0))
    
    await db.cash_tables.update_one({"id": tid}, {"$set": {"status": "closed", "rake_collected": rake, "jackpot_collected": jackpot}})
    await db.waitlist.update_many({"table_id": tid}, {"$set": {"status": "cancelled"}})
    
    t = await db.cash_tables.find_one({"id": tid}, {"_id": 0})
    name = t["name"] if t else "Mesa Cash"
    
    if rake > 0:
        await db.transactions.insert_one({
            "id": gen_id(),
            "type": "income",
            "player_id": "house",
            "amount": rake,
            "payment_method": "cash",
            "description": f"Rake: {name}",
            "created_at": iso(now_utc()),
        })
    if jackpot > 0:
        await db.settings.update_one({"id": "global_jackpot"}, {"$inc": {"balance": jackpot}}, upsert=True)
        await db.transactions.insert_one({
            "id": gen_id(),
            "type": "jackpot_in",
            "player_id": "house",
            "amount": jackpot,
            "payment_method": "cash",
            "description": f"Jackpot: {name}",
            "created_at": iso(now_utc()),
        })
        
    return {"ok": True}


@api.delete("/cash-tables/{tid}")
async def delete_table(tid: str, _: dict = Depends(require_admin)):
    await db.cash_tables.delete_one({"id": tid})
    await db.waitlist.delete_many({"table_id": tid})
    return {"ok": True}


@api.post("/cash-tables/{tid}/seat")
async def seat_player(tid: str, delta: int = Query(1), _: dict = Depends(get_current_user)):
    t = await db.cash_tables.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Mesa não encontrada")
    new_count = max(0, min(t.get("max_seats", 9), t.get("seated_count", 0) + delta))
    await db.cash_tables.update_one({"id": tid}, {"$set": {"seated_count": new_count}})
    return {"seated_count": new_count}


# ---------- Waitlist ----------
@api.get("/cash-tables/{tid}/waitlist", response_model=List[WaitlistEntryOut])
async def get_waitlist(tid: str, _: dict = Depends(get_current_user)):
    docs = await db.waitlist.find({"table_id": tid, "status": {"$in": ["waiting", "called"]}}, {"_id": 0}).sort("position", 1).to_list(200)
    return [WaitlistEntryOut(**d) for d in docs]


@api.post("/cash-tables/{tid}/waitlist", response_model=WaitlistEntryOut)
async def add_waitlist(tid: str, player_id: str = Query(...), _: dict = Depends(get_current_user)):
    p = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Jogador não encontrado")
    last = await db.waitlist.find({"table_id": tid, "status": {"$in": ["waiting", "called"]}}, {"_id": 0}).sort("position", -1).limit(1).to_list(1)
    pos = (last[0]["position"] + 1) if last else 1
    doc = {
        "id": gen_id(),
        "table_id": tid,
        "player_id": player_id,
        "player_name": p["name"],
        "position": pos,
        "status": "waiting",
        "created_at": iso(now_utc()),
    }
    await db.waitlist.insert_one(doc)
    doc.pop("_id", None)
    return WaitlistEntryOut(**doc)


@api.post("/waitlist/{wid}/status")
async def update_waitlist_status(
    wid: str,
    status: str = Query(...),
    amount: float = Query(0),
    method: str = Query("debt"),
    _: dict = Depends(get_current_user)
):
    if status not in ("waiting", "called", "seated", "cancelled"):
        raise HTTPException(400, "Status inválido")
    w = await db.waitlist.find_one({"id": wid}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Item não encontrado")
    
    # If player is leaving the seat
    if w["status"] == "seated" and status != "seated":
        await db.cash_tables.update_one({"id": w["table_id"]}, {"$inc": {"seated_count": -1}})
        
    await db.waitlist.update_one({"id": wid}, {"$set": {"status": status}})
    
    if status == "seated" and w["status"] != "seated":
        await db.cash_tables.update_one({"id": w["table_id"]}, {"$inc": {"seated_count": 1}})
        if amount > 0:
            charge_id = gen_id()
            c_doc = {
                "id": charge_id,
                "table_id": w["table_id"],
                "session_id": wid,
                "player_id": w["player_id"],
                "player_name": w["player_name"],
                "type": "cash_buyin",
                "amount": float(amount),
                "payment_status": "on_debt" if method == "debt" else "paid",
                "payment_method": method,
                "description": "Entrada Cash Game",
                "created_at": iso(now_utc()),
            }
            if method != "debt":
                c_doc["settled_at"] = iso(now_utc())
            await db.charges.insert_one(c_doc)
            
            if method == "debt":
                await db.players.update_one({"id": w["player_id"]}, {"$inc": {"debt_balance": float(amount)}})
                await db.transactions.insert_one({
                    "id": gen_id(),
                    "type": "debt_added",
                    "player_id": w["player_id"],
                    "amount": float(amount),
                    "payment_method": "debt",
                    "description": "Entrada Cash Game",
                    "charge_id": charge_id,
                    "session_id": wid,
                    "created_at": iso(now_utc()),
                })
            else:
                await db.transactions.insert_one({
                    "id": gen_id(),
                    "type": "income",
                    "player_id": w["player_id"],
                    "amount": float(amount),
                    "payment_method": method,
                    "description": "Entrada Cash Game",
                    "charge_id": charge_id,
                    "session_id": wid,
                    "created_at": iso(now_utc()),
                })
    return {"ok": True}

@api.post("/waitlist/{wid}/cashout")
async def cashout_player(
    wid: str,
    amount: float = Query(...),
    method: str = Query("debt"),
    _: dict = Depends(get_current_user)
):
    w = await db.waitlist.find_one({"id": wid}, {"_id": 0})
    if not w:
        raise HTTPException(404, "Item não encontrado")
    
    # Get total buy-in for this session to calculate profit/loss
    charges = await db.charges.find({"session_id": wid, "type": "cash_buyin"}).to_list(None)
    total_buyin = sum(float(c.get("amount", 0)) for c in charges)
    balance = float(amount) - total_buyin
    
    if w["status"] == "seated":
        await db.cash_tables.update_one({"id": w["table_id"]}, {"$inc": {"seated_count": -1}})
        
    await db.waitlist.update_one({"id": wid}, {"$set": {"status": "finished"}})
    
    # Record the cashout record
    charge_id = gen_id()
    await db.charges.insert_one({
        "id": charge_id,
        "table_id": w["table_id"],
        "session_id": wid,
        "player_id": w["player_id"],
        "player_name": w["player_name"],
        "type": "cash_cashout",
        "amount": float(amount),
        "payment_status": "paid",
        "payment_method": method,
        "description": "Saída Cash Game",
        "created_at": iso(now_utc()),
    })

    # Standard debt adjustment: decrease debt by cashout amount
    # (Debt was increased by total_buyin when seated/rebuying)
    await db.players.update_one({"id": w["player_id"]}, {"$inc": {"debt_balance": -float(amount)}})
    
    # Rake and Jackpot calculation (always accrual based on house's win)
    if balance < 0:
        house_win = abs(balance)
        rake_amt = round(house_win * 0.7143, 2)
        jackpot_amt = round(house_win * 0.2857, 2)
        
        if rake_amt > 0:
            await db.transactions.insert_one({
                "id": gen_id(),
                "type": "income",
                "player_id": "house",
                "amount": rake_amt,
                "payment_method": "cash",
                "description": f"Rake (Cash): {w['player_name']}",
                "session_id": wid,
                "created_at": iso(now_utc()),
            })
        if jackpot_amt > 0:
            await db.settings.update_one({"id": "global_jackpot"}, {"$inc": {"balance": jackpot_amt}}, upsert=True)
            await db.transactions.insert_one({
                "id": gen_id(),
                "type": "jackpot_in",
                "player_id": "house",
                "amount": jackpot_amt,
                "payment_method": "cash",
                "description": f"Jackpot (Cash): {w['player_name']}",
                "session_id": wid,
                "created_at": iso(now_utc()),
            })

    # If a settlement method (Cash/PIX) is used, record transaction and clear the session debt
    if method != "debt":
        if balance > 0:
            # HOUSE PAYS PLAYER (Expense)
            await db.transactions.insert_one({
                "id": gen_id(),
                "type": "expense",
                "player_id": w["player_id"],
                "amount": abs(balance),
                "payment_method": method,
                "description": f"Saída Cash (Lucro Pago): {w['player_name']}",
                "session_id": wid,
                "created_at": iso(now_utc()),
            })
            # Neutralize the credit in debt_balance because it was paid in cash
            await db.players.update_one({"id": w["player_id"]}, {"$inc": {"debt_balance": abs(balance)}})
        elif balance < 0:
            # PLAYER PAYS HOUSE (Income/Debt Payment)
            await db.transactions.insert_one({
                "id": gen_id(),
                "type": "debt_payment",
                "player_id": w["player_id"],
                "amount": abs(balance),
                "payment_method": method,
                "description": f"Acerto Cash (Perda Recebida): {w['player_name']}",
                "session_id": wid,
                "created_at": iso(now_utc()),
            })
            # Neutralize the remaining debt because it was paid in cash
            await db.players.update_one({"id": w["player_id"]}, {"$inc": {"debt_balance": -abs(balance)}})
            
    return {"ok": True}

@api.get("/cash-tables/{tid}/seated")
async def get_seated(tid: str, _: dict = Depends(get_current_user)):
    docs = await db.waitlist.find({"table_id": tid, "status": "seated"}, {"_id": 0}).sort("created_at", 1).to_list(200)
    for d in docs:
        charges = await db.charges.find({"session_id": d["id"]}).to_list(100)
        d["total_buyin"] = sum(c["amount"] for c in charges if c["type"] == "cash_buyin")
        d["total_cashout"] = sum(c["amount"] for c in charges if c["type"] == "cash_cashout")
    return docs

@api.get("/cash-tables/{tid}/summary")
async def get_table_summary(tid: str, _: dict = Depends(get_current_user)):
    buyins = await db.charges.find({"table_id": tid, "type": "cash_buyin"}, {"amount": 1}).to_list(None)
    cashouts = await db.charges.find({"table_id": tid, "type": "cash_cashout"}, {"amount": 1}).to_list(None)
    
    total_buyins = sum(c.get("amount", 0) for c in buyins)
    total_cashouts = sum(c.get("amount", 0) for c in cashouts)
    total_collected = max(0, total_buyins - total_cashouts)
    
    suggested_rake = round(total_collected * 0.7143, 2)
    suggested_jackpot = round(total_collected * 0.2857, 2)
    
    return {
        "total_buyins": total_buyins,
        "total_cashouts": total_cashouts,
        "total_collected": total_collected,
        "suggested_rake": suggested_rake,
        "suggested_jackpot": suggested_jackpot
    }

@api.get("/jackpot")
async def get_jackpot(_: dict = Depends(get_current_user)):
    j = await db.settings.find_one({"id": "global_jackpot"}, {"_id": 0})
    return {"balance": j["balance"] if j else 0.0}

@api.post("/jackpot/adjust")
async def adjust_jackpot(amount: float = Query(...), description: str = Query("Ajuste Manual"), _: dict = Depends(require_admin)):
    await db.settings.update_one({"id": "global_jackpot"}, {"$inc": {"balance": amount}}, upsert=True)
    await db.transactions.insert_one({
        "id": gen_id(),
        "type": "jackpot_in" if amount >= 0 else "jackpot_out",
        "player_id": "house",
        "amount": abs(amount),
        "payment_method": "cash",
        "description": description,
        "created_at": iso(now_utc()),
    })
    return {"ok": True}


# ---------- Rankings ----------
@api.get("/rankings")
async def rankings(
    tournament_ids: Optional[str] = None,  # comma-separated
    types: Optional[str] = None,  # comma-separated
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    discards: int = Query(0),
    _: dict = Depends(get_current_user),
):
    t_query: Dict[str, Any] = {}
    if tournament_ids:
        ids = [i for i in tournament_ids.split(",") if i]
        if ids:
            t_query["id"] = {"$in": ids}
    if types:
        type_list = [t for t in types.split(",") if t]
        if type_list:
            t_query["type"] = {"$in": type_list}
    if date_from or date_to:
        rng: Dict[str, Any] = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to + "T23:59:59"
        t_query["start_at"] = rng
    selected = await db.tournaments.find(t_query, {"_id": 0, "id": 1, "name": 1}).to_list(2000)
    selected_ids = [t["id"] for t in selected]
    entries = await db.entries.find({"tournament_id": {"$in": selected_ids}}, {"_id": 0}).to_list(20000)
    by_player: Dict[str, Dict[str, Any]] = {}
    for e in entries:
        pid = e["player_id"]
        if pid not in by_player:
            by_player[pid] = {
                "player_id": pid,
                "player_name": e.get("player_name", "—"),
                "scores": [],
                "tournaments": 0,
                "best_position": None,
                "itm": 0,
            }
        rec = by_player[pid]
        rec["scores"].append(float(e.get("points", 0)))
        rec["tournaments"] += 1
        pos = e.get("final_position")
        if pos:
            if rec["best_position"] is None or pos < rec["best_position"]:
                rec["best_position"] = pos
            if pos <= 9:
                rec["itm"] += 1
                
    stages_to_count = max(0, len(selected_ids) - discards)
    
    for rec in by_player.values():
        rec["total_points"] = sum(sorted(rec["scores"], reverse=True)[:stages_to_count]) if stages_to_count > 0 else 0
        del rec["scores"]

    ranking = sorted(by_player.values(), key=lambda x: (-x["total_points"], -x["tournaments"]))
    for idx, r in enumerate(ranking, start=1):
        r["rank"] = idx
        r["total_points"] = round(r["total_points"], 2)
    return {"ranking": ranking, "tournaments": selected, "count": len(ranking)}


# ---------- Dashboard ----------
@api.get("/dashboard/summary")
async def dashboard_summary(_: dict = Depends(get_current_user)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = iso(today_start)
    
    # 1. Tournament Rake (Accrual)
    entries_today = await db.entries.find({"created_at": {"$gte": today_iso}}, {"_id": 0, "tournament_id": 1}).to_list(10000)
    t_ids = list(set(e["tournament_id"] for e in entries_today))
    tournaments = await db.tournaments.find({"id": {"$in": t_ids}}, {"_id": 0, "id": 1, "rake": 1}).to_list(1000)
    rake_map = {t["id"]: float(t.get("rake", 0)) for t in tournaments}
    tour_rake = sum(rake_map.get(e["tournament_id"], 0) for e in entries_today)
    
    # 2. Cash Rake + Manual adjustments
    txs_today = await db.transactions.find({"created_at": {"$gte": today_iso}}, {"_id": 0}).to_list(5000)
    cash_rake = 0.0
    manual_adj = 0.0
    for t in txs_today:
        ttype = t.get("type")
        desc = t.get("description", "")
        amt = float(t.get("amount", 0))
        if ttype == "income" and "Rake" in desc:
            cash_rake += amt
        elif ttype == "manual_in":
            manual_adj += amt
        elif ttype == "manual_out":
            manual_adj -= amt
            
    revenue_today = tour_rake + cash_rake + manual_adj
    
    open_tables = await db.cash_tables.count_documents({"status": "open"})
    ongoing_tournaments = await db.tournaments.count_documents({"status": "in_progress"})
    
    # active players
    in_prog = await db.tournaments.find({"status": "in_progress"}, {"_id": 0, "id": 1}).to_list(200)
    in_prog_ids = [t["id"] for t in in_prog]
    active_players_set = set()
    if in_prog_ids:
        active_entries = await db.entries.find({"tournament_id": {"$in": in_prog_ids}, "status": "active"}, {"_id": 0, "player_id": 1}).to_list(2000)
        for e in active_entries:
            active_players_set.add(e["player_id"])
    
    seated_count = 0
    open_tables_docs = await db.cash_tables.find({"status": "open"}, {"_id": 0}).to_list(100)
    for tt in open_tables_docs:
        seated_count += int(tt.get("seated_count", 0))
        
    total_players = await db.players.count_documents({})
    total_debt_doc = await db.players.aggregate([{"$group": {"_id": None, "total": {"$sum": "$debt_balance"}}}]).to_list(1)
    total_debt = float(total_debt_doc[0]["total"]) if total_debt_doc else 0.0
    
    pending_charges = await db.charges.aggregate([
        {"$match": {"payment_status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    pending_total = float(pending_charges[0]["total"]) if pending_charges else 0.0
    pending_count = int(pending_charges[0]["count"]) if pending_charges else 0
    
    return {
        "revenue_today": round(revenue_today, 2),
        "open_tables": open_tables,
        "ongoing_tournaments": ongoing_tournaments,
        "active_players": len(active_players_set) + seated_count,
        "total_players": total_players,
        "total_debt": round(total_debt, 2),
        "pending_total": round(pending_total, 2),
        "pending_count": pending_count,
    }


@api.get("/dashboard/revenue")
async def dashboard_revenue(days: int = 7, _: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_iso = iso(start)
    
    # Fetch all data needed for the period
    all_entries = await db.entries.find({"created_at": {"$gte": start_iso}}, {"_id": 0, "tournament_id": 1, "created_at": 1}).to_list(50000)
    all_txs = await db.transactions.find({"created_at": {"$gte": start_iso}}, {"_id": 0, "type": 1, "amount": 1, "description": 1, "created_at": 1}).to_list(20000)
    
    t_ids = list(set(e["tournament_id"] for e in all_entries))
    tournaments = await db.tournaments.find({"id": {"$in": t_ids}}, {"_id": 0, "id": 1, "rake": 1}).to_list(2000)
    rake_map = {t["id"]: float(t.get("rake", 0)) for t in tournaments}
    
    buckets: Dict[str, float] = {}
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        buckets[d] = 0.0
        
    # Add Tournament Rake
    for e in all_entries:
        try:
            d = datetime.fromisoformat(e["created_at"].replace("Z", "+00:00")).date().isoformat()
            if d in buckets:
                buckets[d] += rake_map.get(e["tournament_id"], 0)
        except Exception: continue
        
    # Add Cash Rake and Manual Adjustments
    for t in all_txs:
        try:
            d = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00")).date().isoformat()
            if d in buckets:
                ttype = t.get("type")
                desc = t.get("description", "")
                amt = float(t.get("amount", 0))
                if ttype == "income" and "Rake" in desc:
                    buckets[d] += amt
                elif ttype == "manual_in":
                    buckets[d] += amt
                elif ttype == "manual_out":
                    buckets[d] -= amt
        except Exception: continue
        
    return [{"date": k, "revenue": round(v, 2)} for k, v in sorted(buckets.items())]


# ---------- Mount ----------
app.include_router(api)

_cors = os.environ.get("CORS_ORIGINS", "").strip()
if _cors and _cors != "*":
    _origins = [o.strip() for o in _cors.split(",") if o.strip()]
else:
    _frontend = os.environ.get("FRONTEND_URL", "").strip()
    _origins = [_frontend] if _frontend else ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
