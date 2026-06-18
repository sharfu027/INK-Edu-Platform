from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId

from app.config.database import get_database
from app.middleware.auth_middleware import security, get_current_user
from app.models.inventory import InventoryCreate, InventoryUpdate, InventoryResponse, InventoryInDB
from app.routes.auth_routes import _is_admin
from app.models.user import StandardResponse

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

@router.get("", response_model=StandardResponse)
async def get_inventory(credentials: HTTPAuthorizationCredentials = Depends(security), db=Depends(get_database)):
    payload = await get_current_user(credentials)
    inventory = []
    async for i in db.inventory.find():
        i["_id"] = str(i["_id"])
        inventory.append(i)
    return StandardResponse(status=True, message="Inventory fetched", data=inventory)

@router.post("", response_model=StandardResponse)
async def create_inventory(
    inventory: InventoryCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    inventory_dict = inventory.model_dump()
    
    # Auto-generate ProductId if needed
    if inventory_dict.get("ProductId") in [None, "", "AUTO-GENERATED"]:
        highest = await db.inventory.find_one(
            {"ProductId": {"$regex": "^PRID-\\d+$"}},
            sort=[("ProductId", -1)]
        )
        next_num = 1
        if highest:
            try:
                code_str = highest["ProductId"]
                parts = code_str.split("-")
                if len(parts) > 1:
                    next_num = int(parts[1]) + 1
            except Exception:
                next_num = 1
        
        # Collision safety loop
        generated_code = ""
        code_exists = True
        while code_exists:
            generated_code = f"PRID-{str(next_num).zfill(5)}"
            existing_code = await db.inventory.find_one({"ProductId": generated_code})
            if not existing_code:
                code_exists = False
            else:
                next_num += 1
        inventory_dict["ProductId"] = generated_code
        
    # Auto-generate ProductCode if needed
    if inventory_dict.get("ProductCode") in [None, "", "AUTO-GENERATED"]:
        highest = await db.inventory.find_one(
            {"ProductCode": {"$regex": "^PROD-\\d+$"}},
            sort=[("ProductCode", -1)]
        )
        next_num = 1
        if highest:
            try:
                code_str = highest["ProductCode"]
                parts = code_str.split("-")
                if len(parts) > 1:
                    next_num = int(parts[1]) + 1
            except Exception:
                next_num = 1
        
        # Collision safety loop
        generated_code = ""
        code_exists = True
        while code_exists:
            generated_code = f"PROD-{str(next_num).zfill(5)}"
            existing_code = await db.inventory.find_one({"ProductCode": generated_code})
            if not existing_code:
                code_exists = False
            else:
                next_num += 1
        inventory_dict["ProductCode"] = generated_code
        
    inventory_db = InventoryInDB(**inventory_dict)
    
    # Check unique ProductCode or ProductId if needed, assume ProductCode is unique
    existing = await db.inventory.find_one({"ProductCode": inventory_dict["ProductCode"]})
    if existing:
        return StandardResponse(status=False, message="Product code already exists")
        
    result = await db.inventory.insert_one(inventory_db.model_dump())
    
    return StandardResponse(status=True, message=f"Product created successfully (Code: {inventory_dict['ProductCode']})")

@router.put("/{product_id}", response_model=StandardResponse)
async def update_inventory(
    product_id: str,
    inventory: InventoryUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID")
        
    update_data = {k: v for k, v in inventory.model_dump(exclude_unset=True).items() if v is not None}
    
    if "ProductCode" in update_data:
        existing = await db.inventory.find_one({"ProductCode": update_data["ProductCode"], "_id": {"$ne": ObjectId(product_id)}})
        if existing:
            return StandardResponse(status=False, message="Product code already exists")

    if not update_data:
        return StandardResponse(status=True, message="No changes provided")

    result = await db.inventory.update_one(
        {"_id": ObjectId(product_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        return StandardResponse(status=False, message="Product not found or no changes made")
        
    return StandardResponse(status=True, message="Product updated successfully")

@router.delete("/{product_id}", response_model=StandardResponse)
async def delete_product(
    product_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID")
        
    result = await db.inventory.delete_one({"_id": ObjectId(product_id)})
    if result.deleted_count == 0:
        return StandardResponse(status=False, message="Product not found")
        
    return StandardResponse(status=True, message="Product deleted successfully")

