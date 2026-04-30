from fastapi import APIRouter, Depends, HTTPException
from auth_utils import db, get_current_user, require_admin, gen_id, iso, now_utc
from models import PointStructureIn, PointStructureOut
from typing import List

router = APIRouter(prefix="/point-structures", tags=["Point Structures"])

@router.get("", response_model=List[PointStructureOut])
async def list_point_structures(_: dict = Depends(get_current_user)):
    docs = await db.point_structures.find({}, {"_id": 0}).to_list(200)
    return [PointStructureOut(**d) for d in docs]

@router.post("", response_model=PointStructureOut)
async def create_point_structure(body: PointStructureIn, _: dict = Depends(require_admin)):
    doc = {"id": gen_id(), **body.model_dump(), "created_at": iso(now_utc())}
    await db.point_structures.insert_one(doc)
    doc.pop("_id", None)
    return PointStructureOut(**doc)

@router.put("/{ps_id}", response_model=PointStructureOut)
async def update_point_structure(ps_id: str, body: PointStructureIn, _: dict = Depends(require_admin)):
    res = await db.point_structures.find_one_and_update(
        {"id": ps_id},
        {"$set": body.model_dump()},
        return_document=True,
        projection={"_id": 0}
    )
    if not res: raise HTTPException(404, "Estrutura não encontrada")
    return PointStructureOut(**res)

@router.delete("/{ps_id}")
async def delete_point_structure(ps_id: str, _: dict = Depends(require_admin)):
    await db.point_structures.delete_one({"id": ps_id})
    return {"ok": True}
