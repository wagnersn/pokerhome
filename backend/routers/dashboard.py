from fastapi import APIRouter, Depends
from auth_utils import db, get_current_user, iso, now_utc
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
async def dashboard_summary(_: dict = Depends(get_current_user)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = iso(today_start)
    
    # Tournament Rake
    entries_today = await db.entries.find({"created_at": {"$gte": today_iso}}, {"_id": 0, "tournament_id": 1}).to_list(10000)
    t_ids = list(set(e["tournament_id"] for e in entries_today))
    tournaments = await db.tournaments.find({"id": {"$in": t_ids}}, {"id": 1, "rake": 1}).to_list(1000)
    rake_map = {t["id"]: float(t.get("rake", 0)) for t in tournaments}
    tour_rake = sum(rake_map.get(e["tournament_id"], 0) for e in entries_today)
    
    # Cash Rake + Manual
    txs_today = await db.transactions.find({"created_at": {"$gte": today_iso}}, {"_id": 0}).to_list(5000)
    cash_rake = 0.0
    manual_adj = 0.0
    for t in txs_today:
        ttype = t.get("type")
        amt = float(t.get("amount", 0))
        if ttype == "income" and "Rake" in t.get("description", ""):
            cash_rake += amt
        elif ttype == "manual_in":
            manual_adj += amt
            
    # Bar Revenue Today
    sales_today = await db.sales.find({"created_at": {"$gte": today_iso}}, {"total_amount": 1}).to_list(5000)
    bar_revenue = sum(float(s["total_amount"]) for s in sales_today)
            
    rake_today = tour_rake + cash_rake + manual_adj
    revenue_today = max(0.0, rake_today + bar_revenue)
    
    # Totals
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
        "rake_today": round(rake_today, 2),
        "bar_revenue_today": round(bar_revenue, 2),
        "open_tables": await db.cash_tables.count_documents({"status": "open"}),
        "ongoing_tournaments": await db.tournaments.count_documents({"status": "in_progress"}),
        "total_players": total_players,
        "total_debt": round(total_debt, 2),
        "pending_total": round(pending_total, 2),
        "pending_count": pending_count,
    }

@router.get("/revenue")
async def dashboard_revenue(days: int = 7, _: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_iso = iso(start)
    
    all_entries = await db.entries.find({"created_at": {"$gte": start_iso}}, {"_id": 0, "tournament_id": 1, "created_at": 1}).to_list(50000)
    all_txs = await db.transactions.find({"created_at": {"$gte": start_iso}}, {"_id": 0, "type": 1, "amount": 1, "description": 1, "created_at": 1}).to_list(20000)
    all_sales = await db.sales.find({"created_at": {"$gte": start_iso}}, {"_id": 0, "total_amount": 1, "created_at": 1}).to_list(20000)
    
    t_ids = list(set(e["tournament_id"] for e in all_entries))
    tournaments = await db.tournaments.find({"id": {"$in": t_ids}}, {"_id": 0, "id": 1, "rake": 1}).to_list(2000)
    rake_map = {t["id"]: float(t.get("rake", 0)) for t in tournaments}
    
    buckets: Dict[str, Dict[str, float]] = {}
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        buckets[d] = {"rake": 0.0, "bar_revenue": 0.0}
        
    for e in all_entries:
        try:
            d = datetime.fromisoformat(e["created_at"].replace("Z", "+00:00")).date().isoformat()
            if d in buckets: buckets[d]["rake"] += rake_map.get(e["tournament_id"], 0)
        except: continue
        
    for t in all_txs:
        try:
            d = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00")).date().isoformat()
            if d in buckets:
                ttype = t.get("type")
                amt = float(t.get("amount", 0))
                if ttype == "income" and "Rake" in t.get("description", ""): buckets[d]["rake"] += amt
                elif ttype == "manual_in": buckets[d]["rake"] += amt
        except: continue

    for s in all_sales:
        try:
            d = datetime.fromisoformat(s["created_at"].replace("Z", "+00:00")).date().isoformat()
            if d in buckets: buckets[d]["bar_revenue"] += float(s["total_amount"])
        except: continue
        
    return [
        {
            "date": k, 
            "revenue": round(max(0.0, v["rake"] + v["bar_revenue"]), 2),
            "rake": round(max(0.0, v["rake"]), 2),
            "bar_revenue": round(max(0.0, v["bar_revenue"]), 2)
        } for k, v in sorted(buckets.items())
    ]
