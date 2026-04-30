from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Literal, Dict, Any

class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Literal["admin", "operator"]
    created_at: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "operator"] = "operator"

class PlayerIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

class ChargeIn(BaseModel):
    player_id: str
    amount: float
    type: Literal["buyin", "rebuy", "addon", "jackpot", "cash_buyin", "cash_cashout"]
    payment_method: Literal["cash", "pix", "debt"]
    tournament_id: Optional[str] = None
    session_id: Optional[str] = None

class TournamentIn(BaseModel):
    name: str
    type: str
    start_at: str
    buy_in: float
    rake: float
    is_freeroll: bool = False
    point_structure_id: Optional[str] = None

class PrizeDistItem(BaseModel):
    position: int
    percent: float

class PrizeDistributionIn(BaseModel):
    distribution: List[PrizeDistItem]

class TransactionIn(BaseModel):
    player_id: Optional[str] = None
    dealer_id: Optional[str] = None
    type: Literal["manual_in", "manual_out", "debt_payment", "cash_chip_sale", "expense"]
    amount: float
    payment_method: Literal["cash", "pix"]
    description: Optional[str] = None

class WaitlistIn(BaseModel):
    player_id: str
    player_name: str
    table_id: str
    buyin: float
    payment_method: Literal["cash", "pix", "debt"]

class CashTableIn(BaseModel):
    name: str
    blinds: str
    min_buyin: float
    max_buyin: float

class PointRule(BaseModel):
    position: int
    points: float

class PointStructureIn(BaseModel):
    name: str
    rules: List[PointRule]

class DealerIn(BaseModel):
    name: str
    active: bool = True

class DealerPaymentIn(BaseModel):
    amount: float
    payment_method: Literal["cash", "pix"]
    description: Optional[str] = None
