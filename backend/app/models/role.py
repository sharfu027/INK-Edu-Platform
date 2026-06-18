from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class RoleBase(BaseModel):
    RoleCode: Optional[str] = "AUTO-GENERATED"
    Rolename: str
    GantAdminPrevillage: bool = False

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseModel):
    RoleCode: Optional[str] = None
    Rolename: Optional[str] = None
    GantAdminPrevillage: Optional[bool] = None

class RoleInDB(RoleBase):
    CreatedBy: str
    CreatedDate: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoleResponse(RoleBase):
    id: str = Field(..., alias="_id")
    CreatedBy: str
    CreatedDate: datetime

    class Config:
        populate_by_name = True
