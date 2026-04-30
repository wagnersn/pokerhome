from fastapi import APIRouter, Depends, HTTPException, Request, Response
from auth_utils import db, get_current_user, gen_id, iso, now_utc, verify_password, create_access_token, get_client_ip, ACCESS_TOKEN_MINUTES
from models import LoginIn, UserOut
from datetime import timedelta

router = APIRouter(prefix="/auth", tags=["Auth"])

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )

@router.post("/login")
async def login(body: LoginIn, response: Response, request: Request):
    email = body.email.lower().strip()
    ip = get_client_ip(request)
    
    recent_fails = await db.login_attempts.count_documents({
        "ip": ip, "email": email, "success": False,
        "created_at": {"$gt": now_utc() - timedelta(minutes=15)}
    })
    if recent_fails >= 5:
        raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em 15 minutos.")

    user = await db.users.find_one({"email": email})
    success = False
    if user and verify_password(body.password, user.get("password_hash", "")):
        success = True

    await db.login_attempts.insert_one({
        "email": email, "ip": ip, "success": success, "created_at": now_utc()
    })

    if not success:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")

    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "token": token,
    }

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(
        id=user["id"], email=user["email"], name=user["name"],
        role=user["role"], created_at=user.get("created_at", iso(now_utc())),
    )
