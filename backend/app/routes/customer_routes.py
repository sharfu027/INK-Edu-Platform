from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId
from typing import List

from app.config.database import get_database
from app.middleware.auth_middleware import security, get_current_user
from app.models.customer import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerInDB
from app.routes.auth_routes import _is_admin
from app.models.user import StandardResponse

router = APIRouter(prefix="/api/customers", tags=["Customers"])

@router.get("", response_model=StandardResponse)
async def get_customers(credentials: HTTPAuthorizationCredentials = Depends(security), db=Depends(get_database)):
    payload = await get_current_user(credentials)
    customers = []
    async for c in db.customers.find():
        c["_id"] = str(c["_id"])
        customers.append(c)
    return StandardResponse(status=True, message="Customers fetched", data=customers)

@router.post("", response_model=StandardResponse)
async def create_customer(
    customer: CustomerCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_doc or not user_doc.get("is_enabled", True):
        raise HTTPException(status_code=403, detail="Unauthorized or disabled account")
    
    customer_dict = customer.model_dump()
    
    # Auto-generate CustomerCode if needed
    if customer_dict.get("CustomerCode") in [None, "", "AUTO-GENERATED"]:
        highest = await db.customers.find_one(
            {"CustomerCode": {"$regex": "^CUST-\\d+$"}},
            sort=[("CustomerCode", -1)]
        )
        next_num = 1
        if highest:
            try:
                code_str = highest["CustomerCode"]
                parts = code_str.split("-")
                if len(parts) > 1:
                    next_num = int(parts[1]) + 1
            except Exception:
                next_num = 1
        
        # Collision safety loop
        generated_code = ""
        code_exists = True
        while code_exists:
            generated_code = f"CUST-{str(next_num).zfill(5)}"
            existing_code = await db.customers.find_one({"CustomerCode": generated_code})
            if not existing_code:
                code_exists = False
            else:
                next_num += 1
        customer_dict["CustomerCode"] = generated_code
        
    customer_db = CustomerInDB(**customer_dict, CreatedBy=user_doc.get("name", "Admin"))
    
    # Check unique MobileNumber
    existing = await db.customers.find_one({"MobileNumber": customer.MobileNumber})
    if existing:
        return StandardResponse(status=False, message="Mobile number already exists")
        
    result = await db.customers.insert_one(customer_db.model_dump())
    
    return StandardResponse(status=True, message=f"Customer created successfully (Code: {customer_dict['CustomerCode']})")

@router.put("/{customer_id}", response_model=StandardResponse)
async def update_customer(
    customer_id: str,
    customer: CustomerUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_doc or not user_doc.get("is_enabled", True):
        raise HTTPException(status_code=403, detail="Unauthorized or disabled account")
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required to edit customer details")
        
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
        
    update_data = {k: v for k, v in customer.model_dump(exclude_unset=True).items() if v is not None}
    
    if "MobileNumber" in update_data:
        existing = await db.customers.find_one({"MobileNumber": update_data["MobileNumber"], "_id": {"$ne": ObjectId(customer_id)}})
        if existing:
            return StandardResponse(status=False, message="Mobile number already exists")

    if not update_data:
        return StandardResponse(status=True, message="No changes provided")

    result = await db.customers.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        return StandardResponse(status=False, message="Customer not found or no changes made")
        
    return StandardResponse(status=True, message="Customer updated successfully")

@router.delete("/{customer_id}", response_model=StandardResponse)
async def delete_customer(
    customer_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_doc or not user_doc.get("is_enabled", True):
        raise HTTPException(status_code=403, detail="Unauthorized or disabled account")
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required to delete customers")
        
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID")
        
    result = await db.customers.delete_one({"_id": ObjectId(customer_id)})
    if result.deleted_count == 0:
        return StandardResponse(status=False, message="Customer not found")
        
    return StandardResponse(status=True, message="Customer deleted successfully")

