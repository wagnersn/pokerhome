import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from auth_utils import db, get_current_user, require_admin, iso, now_utc
from models import PlayerIn

router = APIRouter(prefix="/players", tags=["Players"])

@router.get("")
async def list_players(_: dict = Depends(get_current_user)):
    players = await db.players.find({}, {"_id": 0}).sort("name", 1).to_list(2000)
    return players

@router.post("")
async def create_player(body: PlayerIn, _: dict = Depends(get_current_user)):
    pid = str(uuid.uuid4())
    player = {
        **body.model_dump(),
        "id": pid,
        "debt_balance": 0.0,
        "created_at": iso(now_utc())
    }
    await db.players.insert_one(player)
    player.pop("_id", None)
    return player

@router.get("/{player_id}/profile")
async def player_profile(player_id: str, _: dict = Depends(get_current_user)):
    p = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Jogador não encontrado")
    
    entries = await db.entries.find({"player_id": player_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # enrichment
    t_ids = [e["tournament_id"] for e in entries]
    tournaments = await db.tournaments.find({"id": {"$in": t_ids}}, {"id": 1, "name": 1, "type": 1}).to_list(1000)
    t_map = {t["id"]: t for t in tournaments}
    for e in entries:
        t_info = t_map.get(e["tournament_id"])
        if t_info:
            e["tournament_name"] = t_info["name"]
            e["tournament_type"] = t_info["type"]

    # Cash sessions enrichment
    finished_waitlist = await db.waitlist.find({"player_id": player_id, "status": "finished"}, {"_id": 0}).sort("created_at", -1).to_list(500)
    cash_sessions = []
    for s in finished_waitlist:
        charges = await db.charges.find({"session_id": s["id"]}).to_list(100)
        buyin = sum(float(c.get("amount", 0)) for c in charges if c["type"] == "cash_buyin")
        cashout = sum(float(c.get("amount", 0)) for c in charges if c["type"] == "cash_cashout")
        cash_sessions.append({
            "id": s["id"],
            "table_name": s.get("table_name", "Mesa Cash"),
            "created_at": s["created_at"],
            "buyin": buyin,
            "cashout": cashout,
            "result": cashout - buyin
        })

    return {
        "player": p,
        "entries": entries,
        "cash_sessions": cash_sessions,
        "stats": {
            "total_tournaments": len(entries),
            "total_itm": sum(1 for e in entries if e.get("final_position") and e["final_position"] <= 9),
            "total_spent": sum(e.get("total_spent", 0) for e in entries),
            "total_cash_buyin": sum(s["buyin"] for s in cash_sessions),
            "total_cash_out": sum(s["cashout"] for s in cash_sessions),
        }
    }

@router.delete("/{player_id}")
async def delete_player(player_id: str, _: dict = Depends(require_admin)):
    # check for charges
    has_charges = await db.charges.find_one({"player_id": player_id})
    if has_charges:
        raise HTTPException(400, "Jogador possui histórico financeiro e não pode ser removido")
    await db.players.delete_one({"id": player_id})
    return {"ok": True}
