from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId
from typing import List

from app.config.database import get_database
from app.middleware.auth_middleware import security, get_current_user
from app.models.role import RoleCreate, RoleUpdate, RoleInDB
from app.routes.auth_routes import _is_admin
from app.models.user import StandardResponse

router = APIRouter(prefix="/api/roles", tags=["Roles"])

@router.get("", response_model=StandardResponse)
async def get_roles(credentials: HTTPAuthorizationCredentials = Depends(security), db=Depends(get_database)):
    payload = await get_current_user(credentials)
    roles = []
    async for r in db.roles.find():
        r["_id"] = str(r["_id"])
        roles.append(r)
    return StandardResponse(status=True, message="Roles fetched successfully", data=roles)

@router.post("", response_model=StandardResponse)
async def create_role(
    role: RoleCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required to create roles")
    
    role_dict = role.model_dump()
    
    # Auto-generate RoleCode if needed
    if role_dict.get("RoleCode") in [None, "", "AUTO-GENERATED"]:
        highest = await db.roles.find_one(
            {"RoleCode": {"$regex": "^ROLE-\\d+$"}},
            sort=[("RoleCode", -1)]
        )
        next_num = 1
        if highest:
            try:
                code_str = highest["RoleCode"]
                parts = code_str.split("-")
                if len(parts) > 1:
                    next_num = int(parts[1]) + 1
            except Exception:
                next_num = 1
        
        # Collision safety loop
        generated_code = ""
        code_exists = True
        while code_exists:
            generated_code = f"ROLE-{str(next_num).zfill(5)}"
            existing_code = await db.roles.find_one({"RoleCode": generated_code})
            if not existing_code:
                code_exists = False
            else:
                next_num += 1
        role_dict["RoleCode"] = generated_code
    
    # Check for unique RoleCode
    existing_code = await db.roles.find_one({"RoleCode": role_dict["RoleCode"]})
    if existing_code:
        return StandardResponse(status=False, message="Role code already exists")
        
    role_db = RoleInDB(**role_dict, CreatedBy=user_doc.get("name", "Admin"))
    db_dict = role_db.model_dump()
    role_id = ObjectId()
    db_dict["_id"] = role_id
    
    await db.roles.insert_one(db_dict)
    
    return StandardResponse(
        status=True, 
        message=f"Role '{role_dict['Rolename']}' created successfully",
        data={"_id": str(role_id)}
    )

@router.put("/{role_id}", response_model=StandardResponse)
async def update_role(
    role_id: str,
    role: RoleUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required to edit roles")
        
    if not ObjectId.is_valid(role_id):
        raise HTTPException(status_code=400, detail="Invalid role ID")
        
    update_data = {k: v for k, v in role.model_dump(exclude_unset=True).items() if v is not None}
    
    if "RoleCode" in update_data:
        existing = await db.roles.find_one({
            "RoleCode": update_data["RoleCode"], 
            "_id": {"$ne": ObjectId(role_id)}
        })
        if existing:
            return StandardResponse(status=False, message="Role code already exists")
            
    if not update_data:
        return StandardResponse(status=True, message="No changes provided")

    result = await db.roles.update_one(
        {"_id": ObjectId(role_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        return StandardResponse(status=False, message="Role not found or no changes made")
        
    return StandardResponse(status=True, message="Role updated successfully")

@router.delete("/{role_id}", response_model=StandardResponse)
async def delete_role(
    role_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required to delete roles")
        
    if not ObjectId.is_valid(role_id):
        raise HTTPException(status_code=400, detail="Invalid role ID")
        
    result = await db.roles.delete_one({"_id": ObjectId(role_id)})
    if result.deleted_count == 0:
        return StandardResponse(status=False, message="Role not found")
        
    return StandardResponse(status=True, message="Role deleted successfully")
