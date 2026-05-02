from fastapi import APIRouter, Depends, HTTPException
from typing import List
from auth_utils import db, get_current_user, require_admin, hash_password, gen_id, iso, now_utc
from models import UserOut, UserCreateIn

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserOut])
async def list_users(admin: dict = Depends(require_admin)):
    cursor = db.users.find({}, {"password_hash": 0, "_id": 0}).sort("name", 1)
    return [u async for u in cursor]

@router.post("", response_model=UserOut)
async def create_user(data: UserCreateIn, admin: dict = Depends(require_admin)):
    existing = await db.users.find_one({"email": data.email.lower().strip()})
    if existing:
        raise HTTPException(400, "E-mail já cadastrado")
    
    user = {
        "id": gen_id(),
        "name": data.name,
        "email": data.email.lower().strip(),
        "password_hash": hash_password(data.password),
        "role": data.role,
        "created_at": iso(now_utc())
    }
    await db.users.insert_one(user)
    
    # Return user without password
    user.pop("password_hash")
    return user

@router.delete("/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    # Prevent deleting yourself
    if user_id == admin["id"]:
        raise HTTPException(400, "Você não pode excluir seu próprio usuário")
        
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Usuário não encontrado")
        
    return {"status": "success"}
