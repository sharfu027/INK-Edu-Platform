from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from bson import ObjectId

from app.config.database import get_database
from app.middleware.auth_middleware import security, get_current_user
from app.models.measurement import MeasurementCreate, MeasurementUpdate, MeasurementResponse, MeasurementInDB
from app.routes.auth_routes import _is_admin
from app.models.user import StandardResponse

router = APIRouter(prefix="/api/measurements", tags=["Measurements"])

@router.get("", response_model=StandardResponse)
async def get_measurements(credentials: HTTPAuthorizationCredentials = Depends(security), db=Depends(get_database)):
    payload = await get_current_user(credentials)
    measurements = []
    async for m in db.measurements.find():
        m["_id"] = str(m["_id"])
        measurements.append(m)
    return StandardResponse(status=True, message="Measurements fetched", data=measurements)

@router.post("", response_model=StandardResponse)
async def create_measurement(
    measurement: MeasurementCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    measurement_dict = measurement.model_dump()
    
    # Auto-generate Measurement Code if needed
    if measurement_dict.get("Code") in [None, "", "AUTO-GENERATED"]:
        highest = await db.measurements.find_one(
            {"Code": {"$regex": "^MEAS-\\d+$"}},
            sort=[("Code", -1)]
        )
        next_num = 1
        if highest:
            try:
                code_str = highest["Code"]
                parts = code_str.split("-")
                if len(parts) > 1:
                    next_num = int(parts[1]) + 1
            except Exception:
                next_num = 1
        
        # Collision safety loop
        generated_code = ""
        code_exists = True
        while code_exists:
            generated_code = f"MEAS-{str(next_num).zfill(5)}"
            existing_code = await db.measurements.find_one({"Code": generated_code})
            if not existing_code:
                code_exists = False
            else:
                next_num += 1
        measurement_dict["Code"] = generated_code
        
    measurement_db = MeasurementInDB(**measurement_dict)
    
    # Check unique ID
    existing = await db.measurements.find_one({"ID": measurement.ID})
    if existing:
        return StandardResponse(status=False, message="Measurement ID already exists")
        
    result = await db.measurements.insert_one(measurement_db.model_dump())
    
    return StandardResponse(status=True, message=f"Measurement created successfully (Code: {measurement_dict['Code']})")

@router.put("/{m_id}", response_model=StandardResponse)
async def update_measurement(
    m_id: str,
    measurement: MeasurementUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if not ObjectId.is_valid(m_id):
        raise HTTPException(status_code=400, detail="Invalid measurement ID")
        
    update_data = {k: v for k, v in measurement.model_dump(exclude_unset=True).items() if v is not None}
    
    if "ID" in update_data:
        existing = await db.measurements.find_one({"ID": update_data["ID"], "_id": {"$ne": ObjectId(m_id)}})
        if existing:
            return StandardResponse(status=False, message="Measurement ID already exists")

    if not update_data:
        return StandardResponse(status=True, message="No changes provided")

    result = await db.measurements.update_one(
        {"_id": ObjectId(m_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        return StandardResponse(status=False, message="Measurement not found or no changes made")
        
    return StandardResponse(status=True, message="Measurement updated successfully")

@router.delete("/{m_id}", response_model=StandardResponse)
async def delete_measurement(
    m_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_database)
):
    payload = await get_current_user(credentials)
    user_id = payload.get("sub")
    
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not await _is_admin(user_doc, db):
        raise HTTPException(status_code=403, detail="Admin access required")
        
    if not ObjectId.is_valid(m_id):
        raise HTTPException(status_code=400, detail="Invalid measurement ID")
        
    result = await db.measurements.delete_one({"_id": ObjectId(m_id)})
    if result.deleted_count == 0:
        return StandardResponse(status=False, message="Measurement not found")
        
    return StandardResponse(status=True, message="Measurement deleted successfully")
