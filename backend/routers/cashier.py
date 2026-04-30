from fastapi import APIRouter, Depends, HTTPException, Body
from auth_utils import get_current_user, require_admin, db, gen_id, iso, now_utc
from models import TransactionIn
from typing import List

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
    
    # If it's jackpot, update setting
    if data.type == "jackpot_in":
        await db.settings.update_one({"id": "global_jackpot"}, {"$inc": {"balance": data.amount}}, upsert=True)
    elif data.type == "manual_out" and "Jackpot" in (data.description or ""):
        await db.settings.update_one({"id": "global_jackpot"}, {"$inc": {"balance": -data.amount}}, upsert=True)
        
    return {"id": doc["id"]}

@router.get("/rake/history")
async def rake_history(_: dict = Depends(get_current_user)):
    # Legacy endpoint, keeping for now but could be merged into transactions
    return await db.transactions.find(
        {"type": {"$in": ["income", "projection_rake", "projection_jackpot"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)

@router.post("/rake/manual")
async def launch_manual_rake(payload: dict = Body(...), _: dict = Depends(require_admin)):
    rake = float(payload.get("rake", 0))
    jackpot = float(payload.get("jackpot", 0))
    table_name = payload.get("table_name", "Geral")
    notes = payload.get("notes", "")
    dealer_id = payload.get("dealer_id")
    
    if rake > 0:
        await db.transactions.insert_one({
            "id": gen_id(),
            "type": "income",
            "amount": rake,
            "dealer_id": dealer_id,
            "description": f"Rake Manual: {table_name} {notes}".strip(),
            "created_at": iso(now_utc()),
        })
    if jackpot > 0:
        await db.transactions.insert_one({
            "id": gen_id(),
            "type": "income",
            "amount": jackpot,
            "dealer_id": dealer_id,
            "description": f"Jackpot Manual: {table_name} {notes}".strip(),
            "created_at": iso(now_utc()),
        })
        await db.settings.update_one({"id": "global_jackpot"}, {"$inc": {"balance": jackpot}}, upsert=True)
        
    return {"ok": True}

@router.get("/jackpot")
async def get_jackpot(_: dict = Depends(get_current_user)):
    res = await db.settings.find_one({"id": "global_jackpot"}, {"_id": 0})
    return res or {"id": "global_jackpot", "balance": 0.0}
