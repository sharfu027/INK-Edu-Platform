from typing import Optional
from pydantic import BaseModel, Field

class InventoryBase(BaseModel):
    ProductId: Optional[str] = "AUTO-GENERATED"
    ProductCode: Optional[str] = "AUTO-GENERATED"
    ProductName: str
    HSNNumber: str
    TaxPercentage: float
    Brand: Optional[str] = None
    Quantity: Optional[str] = None
    Unit: Optional[str] = None
    Pricing: Optional[float] = None

class InventoryCreate(InventoryBase):
    pass

class InventoryUpdate(BaseModel):
    ProductId: Optional[str] = None
    ProductCode: Optional[str] = None
    ProductName: Optional[str] = None
    HSNNumber: Optional[str] = None
    TaxPercentage: Optional[float] = None
    Brand: Optional[str] = None
    Quantity: Optional[str] = None
    Unit: Optional[str] = None
    Pricing: Optional[float] = None

class InventoryInDB(InventoryBase):
    pass

class InventoryResponse(InventoryBase):
    id: str = Field(..., alias="_id")

    class Config:
        populate_by_name = True
