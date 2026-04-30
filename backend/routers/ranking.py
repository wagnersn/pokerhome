from fastapi import APIRouter, Depends, HTTPException, Query
from auth_utils import db, get_current_user, require_admin, gen_id, iso, now_utc
from models import PointStructureIn, PointStructureOut
from typing import List, Optional

router = APIRouter(prefix="/ranking", tags=["Ranking"])

@router.get("/structures", response_model=List[PointStructureOut])
async def list_point_structures(_: dict = Depends(get_current_user)):
    docs = await db.point_structures.find({}, {"_id": 0}).to_list(200)
    return [PointStructureOut(**d) for d in docs]

@router.post("/structures", response_model=PointStructureOut)
async def create_point_structure(body: PointStructureIn, _: dict = Depends(require_admin)):
    doc = {"id": gen_id(), **body.model_dump(), "created_at": iso(now_utc())}
    await db.point_structures.insert_one(doc)
    doc.pop("_id", None)
    return PointStructureOut(**doc)

@router.put("/structures/{ps_id}", response_model=PointStructureOut)
async def update_point_structure(ps_id: str, body: PointStructureIn, _: dict = Depends(require_admin)):
    res = await db.point_structures.find_one_and_update(
        {"id": ps_id},
        {"$set": body.model_dump()},
        return_document=True,
        projection={"_id": 0}
    )
    if not res: raise HTTPException(404, "Estrutura não encontrada")
    return PointStructureOut(**res)

@router.get("/")
async def get_ranking(season: Optional[str] = Query(None)):
    # Ranking logic
    entries = await db.entries.find({"points": {"$gt": 0}}, {"_id": 0}).to_list(10000)
    by_player = {}
    for e in entries:
        pid = e["player_id"]
        if pid not in by_player:
            by_player[pid] = {"player_id": pid, "name": e["player_name"], "total_points": 0.0, "tournaments": 0}
        by_player[pid]["total_points"] += float(e["points"])
        by_player[pid]["tournaments"] += 1
    
    ranking = sorted(by_player.values(), key=lambda x: (-x["total_points"], -x["tournaments"]))
    for idx, r in enumerate(ranking, start=1):
        r["rank"] = idx
        r["total_points"] = round(r["total_points"], 2)
    return {"ranking": ranking}
