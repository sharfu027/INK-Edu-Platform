from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class CustomerBase(BaseModel):
    CustomerCode: str
    CustomerName: str
    ShopName: str
    MobileNumber: str
    GSTNumber: str
    Address: str
    City: str
    State: str
    Pincode: str
    CreditLimit: float

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    CustomerCode: Optional[str] = None
    CustomerName: Optional[str] = None
    ShopName: Optional[str] = None
    MobileNumber: Optional[str] = None
    GSTNumber: Optional[str] = None
    Address: Optional[str] = None
    City: Optional[str] = None
    State: Optional[str] = None
    Pincode: Optional[str] = None
    CreditLimit: Optional[float] = None

class CustomerInDB(CustomerBase):
    CreatedBy: str
    CreatedDate: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerResponse(CustomerBase):
    id: str = Field(..., alias="_id")
    CreatedBy: str
    CreatedDate: datetime

    class Config:
        populate_by_name = True
