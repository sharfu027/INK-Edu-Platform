from typing import Optional
from pydantic import BaseModel, Field

class MeasurementBase(BaseModel):
    ID: str
    Code: str
    Name: str

class MeasurementCreate(MeasurementBase):
    pass

class MeasurementUpdate(BaseModel):
    ID: Optional[str] = None
    Code: Optional[str] = None
    Name: Optional[str] = None

class MeasurementInDB(MeasurementBase):
    pass

class MeasurementResponse(MeasurementBase):
    id: str = Field(..., alias="_id")

    class Config:
        populate_by_name = True
