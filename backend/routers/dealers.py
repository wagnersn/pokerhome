from fastapi import APIRouter, Depends, HTTPException, Body
from auth_utils import get_current_user, require_admin, db, gen_id, iso, now_utc
from models import DealerIn, DealerPaymentIn
from typing import List

router = APIRouter(prefix="/dealers", tags=["Dealers"])

@router.get("")
async def list_dealers(_: dict = Depends(get_current_user)):
    return await db.dealers.find({}, {"_id": 0}).to_list(100)

@router.post("")
async def save_dealer(data: DealerIn, _: dict = Depends(require_admin)):
    did = gen_id()
    await db.dealers.insert_one({
        "id": did,
        "name": data.name,
        "active": data.active,
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc())
    })
    return {"id": did}

@router.patch("/{did}")
async def update_dealer(did: str, data: DealerIn, _: dict = Depends(require_admin)):
    await db.dealers.update_one(
        {"id": did},
        {"$set": {
            "name": data.name,
            "active": data.active,
            "updated_at": iso(now_utc())
        }}
    )
    return {"ok": True}

@router.delete("/{did}")
async def delete_dealer(did: str, _: dict = Depends(require_admin)):
    await db.dealers.delete_one({"id": did})
    return {"ok": True}

@router.post("/{did}/pay")
async def pay_dealer(did: str, data: DealerPaymentIn, _: dict = Depends(require_admin)):
    dealer = await db.dealers.find_one({"id": did})
    if not dealer:
        raise HTTPException(404, "Dealer não encontrado")
    
    await db.transactions.insert_one({
        "id": gen_id(),
        "type": "expense",
        "amount": data.amount,
        "dealer_id": did,
        "payment_method": data.payment_method,
        "description": f"Pagamento Dealer: {dealer['name']} - {data.description or ''}".strip(),
        "created_at": iso(now_utc())
    })
    return {"ok": True}

@router.get("/performance")
async def dealer_performance(_: dict = Depends(get_current_user)):
    dealers = await db.dealers.find({}, {"_id": 0}).to_list(100)
    txs = await db.transactions.find({"dealer_id": {"$exists": True}}, {"_id": 0}).to_list(10000)
    
    perf = []
    for d in dealers:
        d_txs = [t for t in txs if t.get("dealer_id") == d["id"]]
        # Rake entries are income with "Rake" in description
        rake_gen = sum(t["amount"] for t in d_txs if t["type"] == "income" and "Rake" in t.get("description", ""))
        paid = sum(t["amount"] for t in d_txs if t["type"] == "expense")
        perf.append({
            "id": d["id"],
            "name": d["name"],
            "rake_generated": rake_gen,
            "total_paid": paid,
            "net": rake_gen - paid
        })
    return perf
