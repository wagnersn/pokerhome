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

class PlayerOut(PlayerIn):
    id: str
    debt_balance: float
    created_at: str

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

class TournamentOut(TournamentIn):
    id: str
    status: str
    created_at: str
    finished_at: Optional[str] = None
    prize_distribution: Optional[List[Dict[str, Any]]] = None

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
    game_type: str = "Texas Hold'em"
    small_blind: float
    big_blind: float
    max_seats: int = 9
    bb_on_button: bool = False
    rake_percent: float = 5.0
    rake_cap: float = 0.0
    jackpot_percent: float = 2.0
    jackpot_cap: float = 0.0

class CashTableOut(CashTableIn):
    id: str
    status: str
    seated_count: int
    opened_at: Optional[str] = None
    closed_at: Optional[str] = None
    created_at: str

class CashTableSummary(BaseModel):
    total_buyin: float
    total_cashout: float
    total_collected: float   # buy-ins - cashouts (always >= 0 for rake purposes)
    suggested_rake: float
    suggested_jackpot: float

class PointRule(BaseModel):
    position: int
    points: float

class PointStructureIn(BaseModel):
    name: str
    rules: List[PointRule]

class PointStructureOut(PointStructureIn):
    id: str
    created_at: str

class DealerIn(BaseModel):
    name: str
    active: bool = True

class DealerPaymentIn(BaseModel):
    amount: float
    payment_method: Literal["cash", "pix"]
    description: Optional[str] = None

class WaitlistEntryOut(BaseModel):
    id: str
    table_id: str
    player_id: str
    player_name: str
    position: int
    status: str
    created_at: str

class EntryOut(BaseModel):
    id: str
    tournament_id: str
    player_id: str
    player_name: str
    status: str
    entry_type: str
    total_spent: float
    current_chips: int
    final_position: Optional[int] = None
    prize: float = 0.0
    points: float = 0.0
    created_at: str

class ProductIn(BaseModel):
    name: str
    category: str  # e.g., "Bebida", "Salgado", "Janta", "Guloseima"
    buy_price: float
    sell_price: float
    stock: int = 0
    min_stock: int = 0
    image_url: Optional[str] = None
    active: bool = True

class ProductOut(ProductIn):
    id: str
    created_at: str

class SaleItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    total_price: float

class SaleIn(BaseModel):
    items: List[SaleItem]
    total_amount: float
    payment_method: Literal["cash", "pix", "debt"]
    player_id: Optional[str] = None # Optional: link sale to a player (debt)
    notes: Optional[str] = None

class SaleOut(SaleIn):
    id: str
    operator_id: str
    operator_name: str
    created_at: str
