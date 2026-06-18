from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId
from typing import List

from app.config.database import get_database
from app.middleware.auth_middleware import security, get_current_user
from app.models.order import OrderCreate, OrderUpdate, OrderResponse, OrderInDB
from app.routes.auth_routes import _is_admin
from app.models.user import StandardResponse

router = APIRouter(prefix="/api/orders", tags=["Orders"])

@router.get("", response_model=StandardResponse)
async def get_orders(credentials: HTTPAuthorizationCredentials = Depends(security), db=Depends(get_database)):
    payload = await get_current_user(credentials)
    orders = []
    async for o in db.orders.find():
        o["_id"] = str(o["_id"])
        orders.append(o)
    return StandardResponse(status=True, message="Orders fetched successfully", data=orders)

@router.post("", response_model=StandardResponse)
async def create_order(
    order: OrderCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    order_dict = order.model_dump()
    
    # Auto-generate OrderNumber if empty/null/AUTO-GENERATED
    if order_dict.get("OrderNumber") in [None, "", "AUTO-GENERATED"]:
        highest = await db.orders.find_one(
            {"OrderNumber": {"$regex": "^ORD-\\d+$"}},
            sort=[("OrderNumber", -1)]
        )
        next_num = 1
        if highest:
            try:
                code_str = highest["OrderNumber"]
                parts = code_str.split("-")
                if len(parts) > 1:
                    next_num = int(parts[1]) + 1
            except Exception:
                next_num = 1
        
        # Collision safety loop
        generated_code = ""
        code_exists = True
        while code_exists:
            generated_code = f"ORD-{str(next_num).zfill(5)}"
            existing_code = await db.orders.find_one({"OrderNumber": generated_code})
            if not existing_code:
                code_exists = False
            else:
                next_num += 1
        order_dict["OrderNumber"] = generated_code
    else:
        # Check unique OrderNumber if entered manually
        existing = await db.orders.find_one({"OrderNumber": order_dict["OrderNumber"]})
        if existing:
            return StandardResponse(status=False, message="Order number already exists")
            
    order_id = ObjectId()
    order_db = OrderInDB(**order_dict, CreatedBy=user_doc.get("name", "Admin"))
    db_dict = order_db.model_dump()
    db_dict["_id"] = order_id
    
    # Set OrderId for each OrderItem
    for item in db_dict.get("OrderItems", []):
        item["OrderId"] = str(order_id)
        
    await db.orders.insert_one(db_dict)
    
    return StandardResponse(
        status=True, 
        message=f"Order created successfully (Number: {order_dict['OrderNumber']})",
        data={"_id": str(order_id), "OrderNumber": order_dict["OrderNumber"]}
    )

@router.put("/{order_id}", response_model=StandardResponse)
async def update_order(
    order_id: str,
    order: OrderUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order ID")
        
    update_data = {k: v for k, v in order.model_dump(exclude_unset=True).items() if v is not None}
    
    if "OrderNumber" in update_data and update_data["OrderNumber"] not in [None, "", "AUTO-GENERATED"]:
        existing = await db.orders.find_one({
            "OrderNumber": update_data["OrderNumber"], 
            "_id": {"$ne": ObjectId(order_id)}
        })
        if existing:
            return StandardResponse(status=False, message="Order number already exists")
            
    if "OrderItems" in update_data:
        for item in update_data["OrderItems"]:
            item["OrderId"] = order_id

    if not update_data:
        return StandardResponse(status=True, message="No changes provided")

    result = await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        return StandardResponse(status=False, message="Order not found or no changes made")
        
    return StandardResponse(status=True, message="Order updated successfully")

@router.delete("/{order_id}", response_model=StandardResponse)
async def delete_order(
    order_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order ID")
        
    result = await db.orders.delete_one({"_id": ObjectId(order_id)})
    if result.deleted_count == 0:
        return StandardResponse(status=False, message="Order not found")
        
    return StandardResponse(status=True, message="Order deleted successfully")
