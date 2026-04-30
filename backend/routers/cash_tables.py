from fastapi import APIRouter, Depends, HTTPException, Body
from auth_utils import get_current_user, require_admin, db, gen_id, iso, now_utc
from models import CashTableIn, CashTableOut, CashTableSummary
from typing import List

router = APIRouter(prefix="/cash-tables", tags=["Cash Tables"])

@router.get("/", response_model=List[CashTableOut])
async def list_tables(_: dict = Depends(get_current_user)):
    return await db.cash_tables.find({}, {"_id": 0}).to_list(100)

@router.post("/", response_model=CashTableOut)
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

@router.put("/{tid}", response_model=CashTableOut)
async def update_table(tid: str, body: CashTableIn, _: dict = Depends(require_admin)):
    res = await db.cash_tables.find_one_and_update(
        {"id": tid},
        {"$set": body.model_dump()},
        return_document=True,
        projection={"_id": 0}
    )
    if not res: raise HTTPException(404, "Mesa não encontrada")
    return CashTableOut(**res)

@router.delete("/{tid}")
async def delete_table(tid: str, _: dict = Depends(require_admin)):
    await db.cash_tables.delete_one({"id": tid})
    return {"ok": True}

@router.post("/{tid}/open")
async def open_table(tid: str, _: dict = Depends(require_admin)):
    await db.cash_tables.update_one(
        {"id": tid},
        {"$set": {"status": "open", "opened_at": iso(now_utc()), "closed_at": None}}
    )
    return {"ok": True}

@router.get("/{tid}/summary", response_model=CashTableSummary)
async def get_table_summary(tid: str, _: dict = Depends(get_current_user)):
    t = await db.cash_tables.find_one({"id": tid}, {"_id": 0})
    if not t: raise HTTPException(404, "Mesa não encontrada")
    
    charges = await db.charges.find({"table_id": tid, "created_at": {"$gte": t.get("opened_at") or ""}}).to_list(1000)
    bi = sum(float(c["amount"]) for c in charges if c["type"] == "cash_buyin")
    co = sum(float(c["amount"]) for c in charges if c["type"] == "cash_cashout")
    balance = bi - co
    
    rp = t.get("rake_percent", 5.0) / 100.0
    rc = t.get("rake_cap", 0.0)
    jp = t.get("jackpot_percent", 2.0) / 100.0
    jc = t.get("jackpot_cap", 0.0)
    
    proj_rake = balance * rp
    if rc > 0: proj_rake = min(proj_rake, rc)
    
    proj_jack = balance * jp
    if jc > 0: proj_jack = min(proj_jack, jc)
    
    return CashTableSummary(
        total_collected=balance,
        suggested_rake=round(proj_rake, 2),
        suggested_jackpot=round(proj_jack, 2)
    )

@router.post("/{tid}/close")
async def close_table(tid: str, payload: dict = Body(...), _: dict = Depends(require_admin)):
    t = await db.cash_tables.find_one({"id": tid})
    if not t: raise HTTPException(404, "Mesa não encontrada")
    
    name = t.get("name", "Mesa")
    rake = float(payload.get("rake", 0))
    jackpot = float(payload.get("jackpot", 0))
    
    await db.cash_tables.update_one(
        {"id": tid},
        {"$set": {"status": "closed", "closed_at": iso(now_utc()), "seated_count": 0}}
    )
    
    if rake > 0:
        await db.transactions.insert_one({
            "id": gen_id(),
            "type": "income",
            "amount": rake,
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
    
    charges = await db.charges.find({"table_id": tid, "created_at": {"$gte": t.get("opened_at") or ""}}).to_list(1000)
    bi = sum(float(c["amount"]) for c in charges if c["type"] == "cash_buyin")
    co = sum(float(c["amount"]) for c in charges if c["type"] == "cash_cashout")
    balance = bi - co
    if balance > 0:
        rp = t.get("rake_percent", 5.0) / 100.0
        rc = t.get("rake_cap", 0.0)
        jp = t.get("jackpot_percent", 2.0) / 100.0
        jc = t.get("jackpot_cap", 0.0)
        
        proj_rake = balance * rp
        if rc > 0: proj_rake = min(proj_rake, rc)
        proj_jack = balance * jp
        if jc > 0: proj_jack = min(proj_jack, jc)
        
        await db.transactions.insert_one({
            "id": gen_id(), "type": "projection_rake", "amount": round(proj_rake, 2),
            "description": f"Projeção Final Rake: {name}", "created_at": iso(now_utc()),
        })
        await db.transactions.insert_one({
            "id": gen_id(), "type": "projection_jackpot", "amount": round(proj_jack, 2),
            "description": f"Projeção Final Jackpot: {name}", "created_at": iso(now_utc()),
        })

    await db.seats.delete_many({"table_id": tid})
    return {"ok": True}

@router.get("/{tid}/seated")
async def get_seated_players(tid: str, _: dict = Depends(get_current_user)):
    return await db.waitlist.find({"table_id": tid, "status": "seated"}, {"_id": 0}).to_list(100)

@router.post("/{tid}/seat")
async def seat_player(tid: str, delta: int = Query(1), _: dict = Depends(get_current_user)):
    t = await db.cash_tables.find_one({"id": tid}, {"_id": 0})
    if not t: raise HTTPException(404, "Mesa não encontrada")
    new_count = max(0, min(t.get("max_seats", 9), t.get("seated_count", 0) + delta))
    await db.cash_tables.update_one({"id": tid}, {"$set": {"seated_count": new_count}})
    return {"seated_count": new_count}

@router.get("/{tid}/waitlist")
async def get_waitlist(tid: str, _: dict = Depends(get_current_user)):
    return await db.waitlist.find({"table_id": tid, "status": {"$in": ["waiting", "called"]}}, {"_id": 0}).sort("position", 1).to_list(200)

@router.post("/{tid}/waitlist")
async def add_waitlist(tid: str, player_id: str = Query(...), _: dict = Depends(get_current_user)):
    p = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not p: raise HTTPException(404, "Jogador não encontrado")
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
    return {"id": doc["id"]}

@router.post("/waitlist/{wid}/status")
async def update_waitlist_status(wid: str, status: str = Query(...), amount: float = Query(0), method: str = Query("debt"), _: dict = Depends(get_current_user)):
    w = await db.waitlist.find_one({"id": wid}, {"_id": 0})
    if not w: raise HTTPException(404, "Item não encontrado")
    if w["status"] == "seated" and status != "seated":
        await db.cash_tables.update_one({"id": w["table_id"]}, {"$inc": {"seated_count": -1}})
    await db.waitlist.update_one({"id": wid}, {"$set": {"status": status}})
    if status == "seated" and w["status"] != "seated":
        await db.cash_tables.update_one({"id": w["table_id"]}, {"$inc": {"seated_count": 1}})
        if amount > 0:
            charge_id = gen_id()
            c_doc = {
                "id": charge_id, "table_id": w["table_id"], "session_id": wid,
                "player_id": w["player_id"], "player_name": w["player_name"],
                "type": "cash_buyin", "amount": float(amount),
                "payment_status": "on_debt" if method == "debt" else "paid",
                "payment_method": method, "description": "Entrada Cash Game", "created_at": iso(now_utc()),
            }
            if method != "debt": c_doc["settled_at"] = iso(now_utc())
            await db.charges.insert_one(c_doc)
            if method == "debt":
                await db.players.update_one({"id": w["player_id"]}, {"$inc": {"debt_balance": float(amount)}})
                await db.transactions.insert_one({
                    "id": gen_id(), "type": "debt_added", "player_id": w["player_id"],
                    "amount": float(amount), "payment_method": "debt", "description": "Entrada Cash Game",
                    "charge_id": charge_id, "session_id": wid, "created_at": iso(now_utc()),
                })
            else:
                await db.transactions.insert_one({
                    "id": gen_id(), "type": "income", "player_id": w["player_id"],
                    "amount": float(amount), "payment_method": method, "description": "Entrada Cash Game",
                    "charge_id": charge_id, "session_id": wid, "created_at": iso(now_utc()),
                })
    return {"ok": True}

@router.post("/waitlist/{wid}/cashout")
async def cashout_player(wid: str, amount: float = Query(...), method: str = Query("debt"), _: dict = Depends(get_current_user)):
    w = await db.waitlist.find_one({"id": wid}, {"_id": 0})
    if not w: raise HTTPException(404, "Item não encontrado")
    if w["status"] == "seated":
        await db.cash_tables.update_one({"id": w["table_id"]}, {"$inc": {"seated_count": -1}})
    await db.waitlist.update_one({"id": wid}, {"$set": {"status": "finished"}})
    await db.charges.insert_one({
        "id": gen_id(), "table_id": w["table_id"], "session_id": wid,
        "player_id": w["player_id"], "player_name": w["player_name"],
        "type": "cash_cashout", "amount": float(amount),
        "payment_status": "paid", "payment_method": method, "description": "Saída Cash Game", "created_at": iso(now_utc()),
    })
    return {"ok": True}
