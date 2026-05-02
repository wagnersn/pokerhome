from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from auth_utils import db, get_current_user, iso, now_utc, gen_id
from models import ProductIn, ProductOut, SaleIn, SaleOut
from bson import ObjectId

router = APIRouter(prefix="/bar", tags=["Bar & Inventory"])

# --- Products Management ---

@router.get("/products", response_model=List[ProductOut])
async def list_products(active_only: bool = False):
    query = {"active": True} if active_only else {}
    cursor = db.products.find(query).sort([("category", 1), ("name", 1)])
    return [p async for p in cursor]

@router.post("/products", response_model=ProductOut)
async def create_product(data: ProductIn, user=Depends(get_current_user)):
    product = data.dict()
    product["id"] = gen_id()
    product["created_at"] = iso(now_utc())
    await db.products.insert_one(product)
    return product

@router.put("/products/{product_id}", response_model=ProductOut)
async def update_product(product_id: str, data: ProductIn, user=Depends(get_current_user)):
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(404, "Produto não encontrado")
    
    updated = data.dict()
    await db.products.update_one({"id": product_id}, {"$set": updated})
    
    # Return updated doc
    return await db.products.find_one({"id": product_id})

@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Produto não encontrado")
    return {"status": "success"}

# --- Sales ---

@router.post("/sales", response_model=SaleOut)
async def record_sale(data: SaleIn, user=Depends(get_current_user)):
    # 1. Validate stock and prepare sale
    for item in data.items:
        prod = await db.products.find_one({"id": item.product_id})
        if not prod:
            raise HTTPException(400, f"Produto {item.product_name} não encontrado")
        if prod["stock"] < item.quantity:
            raise HTTPException(400, f"Estoque insuficiente para {item.product_name}")

    # 2. Update stock for each item
    for item in data.items:
        await db.products.update_one(
            {"id": item.product_id},
            {"$inc": {"stock": -item.quantity}}
        )

    # 3. Handle debt if payment_method is "debt"
    if data.payment_method == "debt":
        if not data.player_id:
            raise HTTPException(400, "player_id é obrigatório para vendas fiado (debt)")
        
        player = await db.players.find_one({"id": data.player_id})
        if not player:
            raise HTTPException(400, "Jogador não encontrado")
            
        # Add to player debt balance
        await db.players.update_one(
            {"id": data.player_id},
            {"$inc": {"debt_balance": data.total_amount}}
        )
        
        # Log transaction for player
        await db.transactions.insert_one({
            "id": gen_id(),
            "player_id": data.player_id,
            "type": "manual_in", # Using manual_in as a placeholder for "product purchase on debt"
            "amount": data.total_amount,
            "payment_method": "debt",
            "description": f"Consumo Copa: {', '.join([f'{i.quantity}x {i.product_name}' for i in data.items])}",
            "created_at": iso(now_utc())
        })

    # 4. Save sale record
    sale = data.dict()
    sale["id"] = gen_id()
    sale["operator_id"] = user["id"]
    sale["operator_name"] = user["name"]
    sale["created_at"] = iso(now_utc())
    
    await db.sales.insert_one(sale)
    return sale

@router.get("/sales", response_model=List[SaleOut])
async def list_sales(
    player_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = {}
    if player_id:
        query["player_id"] = player_id
    
    if start_date or end_date:
        query["created_at"] = {}
        if start_date:
            query["created_at"]["$gte"] = start_date
        if end_date:
            query["created_at"]["$lte"] = end_date

    cursor = db.sales.find(query).sort("created_at", -1)
    return [s async for s in cursor]
