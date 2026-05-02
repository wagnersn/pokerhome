from fastapi import APIRouter, Depends, HTTPException, Body, Query
from auth_utils import db, get_current_user, require_admin, gen_id, iso, now_utc
from models import TournamentIn, TournamentOut, PrizeDistributionIn, EntryOut
from datetime import timedelta
from typing import List, Optional

router = APIRouter(prefix="/tournaments", tags=["Tournaments"])

@router.get("/stats/marketing")
async def tournament_marketing_stats(days: int = 30, _: dict = Depends(get_current_user)):
    now = now_utc()
    start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_iso = iso(start)
    
    # Get all finished tournaments in range
    tournaments = await db.tournaments.find({
        "status": "finished",
        "created_at": {"$gte": start_iso}
    }).sort("created_at", -1).to_list(1000)
    
    history = []
    total_prize_pool = 0.0
    total_entries = 0
    total_rake = 0.0
    
    for t in tournaments:
        summary = await _get_tournament_summary(t["id"])
        ts = summary["totals"]
        history.append({
            "id": t["id"],
            "name": t["name"],
            "date": t["created_at"],
            "prize_pool": ts["prize_pool"],
            "entries": ts["entries"],
            "rake": ts["rake"]
        })
        total_prize_pool += ts["prize_pool"]
        total_entries += ts["entries"]
        total_rake += ts["rake"]
        
    count = len(tournaments)
    avg_prize = total_prize_pool / count if count > 0 else 0
    avg_entries = total_entries / count if count > 0 else 0
    
    return {
        "period_days": days,
        "total_tournaments": count,
        "total_prize_pool": round(total_prize_pool, 2),
        "avg_prize_pool": round(avg_prize, 2),
        "total_entries": total_entries,
        "avg_entries": round(avg_entries, 1),
        "total_rake": round(total_rake, 2),
        "history": history
    }

@router.get("", response_model=List[TournamentOut])
async def list_tournaments(status: Optional[str] = None, _: dict = Depends(get_current_user)):
    query = {}
    if status: query["status"] = status
    docs = await db.tournaments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [TournamentOut(**d) for d in docs]

@router.post("", response_model=TournamentOut)
async def create_tournament(body: TournamentIn, _: dict = Depends(require_admin)):
    doc = {
        "id": gen_id(),
        **body.model_dump(),
        "status": "scheduled",
        "created_at": iso(now_utc())
    }
    await db.tournaments.insert_one(doc)
    doc.pop("_id", None)
    return TournamentOut(**doc)

@router.get("/{tid}", response_model=TournamentOut)
async def get_tournament(tid: str, _: dict = Depends(get_current_user)):
    t = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    if not t: raise HTTPException(404, "Torneio não encontrado")
    return TournamentOut(**t)

@router.patch("/{tid}", response_model=TournamentOut)
async def update_tournament(tid: str, body: dict = Body(...), _: dict = Depends(require_admin)):
    res = await db.tournaments.find_one_and_update(
        {"id": tid},
        {"$set": body},
        return_document=True,
        projection={"_id": 0}
    )
    if not res: raise HTTPException(404, "Torneio não encontrado")
    return TournamentOut(**res)

@router.delete("/{tid}")
async def delete_tournament(tid: str, _: dict = Depends(require_admin)):
    await db.tournaments.delete_one({"id": tid})
    return {"ok": True}

async def _get_tournament_summary(tid: str):
    t = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    if not t: raise HTTPException(404, "Torneio não encontrado")
    entries = await db.entries.find({"tournament_id": tid}, {"_id": 0}).to_list(2000)
    charges = await db.charges.find({"tournament_id": tid}, {"_id": 0}).to_list(5000)

    total_entries = len(entries)
    gross = sum(float(c["amount"]) for c in charges)
    rake_per_entry = float(t.get("rake", 0))
    total_rake = 0.0 if t.get("is_freeroll") else rake_per_entry * total_entries
    prize_pool = max(0.0, gross - total_rake)

    active = [e for e in entries if e.get("status") == "active"]
    leaderboard = sorted(active, key=lambda e: int(e.get("current_chips", 0)), reverse=True)[:5]

    return {
        "tournament": t,
        "totals": {
            "entries": total_entries,
            "gross": round(gross, 2),
            "rake": round(total_rake, 2),
            "prize_pool": round(prize_pool, 2),
            "active_count": len(active),
        },
        "leaderboard": leaderboard,
        "prize_distribution": t.get("prize_distribution"),
    }

@router.get("/{tid}/summary")
async def tournament_summary(tid: str, _: dict = Depends(get_current_user)):
    return await _get_tournament_summary(tid)

@router.put("/{tid}/prize-distribution")
async def set_prize_distribution(tid: str, body: PrizeDistributionIn, _: dict = Depends(require_admin)):
    summary = await _get_tournament_summary(tid)
    pp = summary["totals"]["prize_pool"]
    dist = []
    for item in body.distribution:
        amount = round(pp * (item.percent / 100.0), 2)
        dist.append({"position": item.position, "percent": item.percent, "amount": amount})
    await db.tournaments.update_one({"id": tid}, {"$set": {"prize_distribution": dist}})
    return {"distribution": dist, "prize_pool": pp}

# --- Entries logic ---
@router.get("/{tid}/entries", response_model=List[EntryOut])
async def list_entries(tid: str, _: dict = Depends(get_current_user)):
    return await db.entries.find({"tournament_id": tid}, {"_id": 0}).to_list(1000)

@router.post("/{tid}/entries")
async def create_entry(tid: str, player_id: str = Query(...), type: str = Query("simple"), method: str = Query("debt"), _: dict = Depends(get_current_user)):
    t = await db.tournaments.find_one({"id": tid})
    p = await db.players.find_one({"id": player_id})
    if not t or not p: raise HTTPException(404, "Não encontrado")
    
    amount = float(t.get("buyin_double" if type == "double" else "buyin", 0))
    eid = gen_id()
    doc = {
        "id": eid, "tournament_id": tid, "player_id": player_id, "player_name": p["name"],
        "status": "active", "entry_type": type, "total_spent": amount,
        "current_chips": int(t.get("chips_double_buyin" if type == "double" else "chips_buyin", 0)),
        "created_at": iso(now_utc())
    }
    await db.entries.insert_one(doc)
    # Add charge and transaction logic here (simulated)
    return {"id": eid}
