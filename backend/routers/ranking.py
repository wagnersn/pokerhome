from fastapi import APIRouter, Depends, HTTPException, Query
from auth_utils import db, get_current_user, require_admin, gen_id, iso, now_utc
from typing import List, Optional

router = APIRouter(prefix="/rankings", tags=["Ranking"])

@router.get("")
async def get_ranking(season: Optional[str] = Query(None)):
    # Ranking logic
    entries = await db.entries.find({"points": {"$gt": 0}}, {"_id": 0}).to_list(10000)
    by_player = {}
    for e in entries:
        pid = e["player_id"]
        if pid not in by_player:
            by_player[pid] = {"player_id": pid, "player_name": e.get("player_name", "—"), "total_points": 0.0, "tournaments": 0}
        by_player[pid]["total_points"] += float(e.get("points", 0))
        by_player[pid]["tournaments"] += 1
    
    ranking = sorted(by_player.values(), key=lambda x: (-x["total_points"], -x["tournaments"]))
    for idx, r in enumerate(ranking, start=1):
        r["rank"] = idx
        r["total_points"] = round(r["total_points"], 2)
    return {"ranking": ranking, "count": len(ranking)}
