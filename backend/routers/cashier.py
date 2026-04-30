from fastapi import APIRouter, Depends, HTTPException, Body, Query
from auth_utils import get_current_user, require_admin, db, gen_id, iso, now_utc
from models import TransactionIn
from typing import List, Optional
from datetime import timedelta

router = APIRouter(prefix="/cashier", tags=["Cashier"])

@router.get("/transactions")
async def list_transactions(
    page: int = 1, 
    limit: int = 50, 
    type: str = None,
    _: dict = Depends(get_current_user)
):
    skip = (page - 1) * limit
    query = {}
    if type: query["type"] = type
    
    items = await db.transactions.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.transactions.count_documents(query)
    return {"items": items, "total": total, "page": page, "limit": limit}

@router.post("/transactions")
async def create_transaction(data: TransactionIn, _: dict = Depends(require_admin)):
    doc = {
        "id": gen_id(),
        **data.model_dump(),
        "created_at": iso(now_utc())
    }
    await db.transactions.insert_one(doc)
    
    if data.type == "debt_payment" and data.player_id:
        await db.players.update_one({"id": data.player_id}, {"$inc": {"debt_balance": -float(data.amount)}})
    
    if data.type == "jackpot_in":
        await db.settings.update_one({"id": "global_jackpot"}, {"$inc": {"balance": data.amount}}, upsert=True)
    elif data.type == "manual_out" and "Jackpot" in (data.description or ""):
        await db.settings.update_one({"id": "global_jackpot"}, {"$inc": {"balance": -data.amount}}, upsert=True)
        
    return {"id": doc["id"]}

@router.get("/pending")
async def cashier_pending(_: dict = Depends(get_current_user)):
    charges = await db.charges.find({"payment_status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    t_ids = list(set(c["tournament_id"] for c in charges if c.get("tournament_id")))
    tournaments = await db.tournaments.find({"id": {"$in": t_ids}}, {"id": 1, "name": 1}).to_list(2000)
    t_map = {t["id"]: t["name"] for t in tournaments}
    for c in charges:
        c["tournament_name"] = t_map.get(c["tournament_id"]) if c.get("tournament_id") else "Cash Game"
    return charges

@router.get("/debtors")
async def list_debtors(_: dict = Depends(get_current_user)):
    docs = await db.players.find({"debt_balance": {"$gt": 0}}, {"_id": 0}).sort("debt_balance", -1).to_list(500)
    return docs

@router.get("/unpaid-prizes")
async def list_unpaid_prizes(_: dict = Depends(get_current_user)):
    tournaments = await db.tournaments.find({
        "status": "finished",
        "prize_distribution": {"$exists": True, "$ne": []}
    }).sort("created_at", -1).to_list(100)
    
    unpaid = []
    for t in tournaments:
        for dist_item in t.get("prize_distribution", []):
            pos = dist_item.get("position")
            entry = await db.entries.find_one({"tournament_id": t["id"], "final_position": pos})
            if entry:
                tx = await db.transactions.find_one({"type": "expense", "player_id": entry["player_id"], "description": {"$regex": f"Prêmio: {t['name']}"}})
                if not tx:
                    unpaid.append({
                        "id": f"{t['id']}_{pos}", "tournament_id": t["id"], "tournament_name": t["name"],
                        "player_id": entry["player_id"], "player_name": entry["player_name"],
                        "position": pos, "amount": dist_item["amount"], "entry_id": entry["id"]
                    })
    return unpaid

@router.post("/charges/{charge_id}/pay")
async def pay_charge(charge_id: str, method: str = Query(...), _: dict = Depends(get_current_user)):
    c = await db.charges.find_one({"id": charge_id}, {"_id": 0})
    if not c: raise HTTPException(404, "Cobrança não encontrada")
    if c["payment_status"] != "pending": raise HTTPException(400, "Cobrança já processada")
    
    new_status = "on_debt" if method == "debt" else "paid"
    await db.charges.update_one({"id": charge_id}, {"$set": {"payment_status": new_status, "payment_method": method, "settled_at": iso(now_utc())}})
    
    if method == "debt" and c.get("player_id"):
        await db.players.update_one({"id": c["player_id"]}, {"$inc": {"debt_balance": float(c["amount"])}})
        await db.transactions.insert_one({
            "id": gen_id(), "type": "debt_added", "player_id": c["player_id"],
            "amount": float(c["amount"]), "payment_method": "debt", "description": f"Dívida: {c.get('description', c['type'])}",
            "charge_id": charge_id, "created_at": iso(now_utc()),
        })
    else:
        await db.transactions.insert_one({
            "id": gen_id(), "type": "tournament_payment", "player_id": c.get("player_id"),
            "amount": float(c["amount"]), "payment_method": method, "description": c.get("description", c["type"]),
            "charge_id": charge_id, "created_at": iso(now_utc()),
        })
    return {"ok": True}

@router.get("/jackpot")
async def get_jackpot(_: dict = Depends(get_current_user)):
    res = await db.settings.find_one({"id": "global_jackpot"}, {"_id": 0})
    return res or {"id": "global_jackpot", "balance": 0.0}

@router.get("/rake/history")
async def rake_history(days: int = 30, _: dict = Depends(get_current_user)):
    now = now_utc()
    start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    return await db.transactions.find({
        "created_at": {"$gte": iso(start)},
        "description": {"$regex": "(Rake|Jackpot)"}
    }, {"_id": 0}).sort("created_at", -1).to_list(2000)
