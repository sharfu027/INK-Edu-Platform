import uuid
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field

class OrderItem(BaseModel):
    Id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    OrderId: Optional[str] = None
    ProductId: str
    Quantity: int
    Price: float
    Tax: float
    Total: float

class OrderBase(BaseModel):
    OrderNumber: str
    CustomerId: str
    SalesmanId: str
    OrderDate: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    TotalAmount: float
    DiscountAmount: float
    TaxAmount: float
    FinalAmount: float
    OrderStatus: str
    Remarks: Optional[str] = None
    OrderItems: List[OrderItem] = []

class OrderCreate(BaseModel):
    OrderNumber: Optional[str] = "AUTO-GENERATED"
    CustomerId: str
    SalesmanId: str
    OrderDate: Optional[datetime] = None
    TotalAmount: float
    DiscountAmount: float
    TaxAmount: float
    FinalAmount: float
    OrderStatus: str
    Remarks: Optional[str] = None
    OrderItems: List[OrderItem] = []

class OrderUpdate(BaseModel):
    OrderNumber: Optional[str] = None
    CustomerId: Optional[str] = None
    SalesmanId: Optional[str] = None
    OrderDate: Optional[datetime] = None
    TotalAmount: Optional[float] = None
    DiscountAmount: Optional[float] = None
    TaxAmount: Optional[float] = None
    FinalAmount: Optional[float] = None
    OrderStatus: Optional[str] = None
    Remarks: Optional[str] = None
    OrderItems: Optional[List[OrderItem]] = None

class OrderInDB(OrderBase):
    CreatedBy: str
    CreatedDate: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderResponse(OrderBase):
    id: str = Field(..., alias="_id")
    CreatedBy: str
    CreatedDate: datetime

    class Config:
        populate_by_name = True
