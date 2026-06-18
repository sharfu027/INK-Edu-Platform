import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load from backend dir
load_dotenv("d:/Intern/face-auth/backend/.env")

PERMANENT_ADMINS = ["rajabaksh@gmail.com", "srujay@gmail.com"]

async def migrate_users():
    mongo_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGODB_DB_NAME")
    if not mongo_url or not db_name:
        print("Error: MONGODB_URL or MONGODB_DB_NAME not found in .env")
        return
        
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Connecting to {db_name}...")
    
    users_cursor = db.users.find()
    async for user in users_cursor:
        email = user.get("email", "").lower()
        update_fields = {}
        
        # Ensure is_enabled exists and is boolean
        if user.get("is_enabled") is None:
            update_fields["is_enabled"] = True if email in PERMANENT_ADMINS else False
            
        # Ensure role exists
        if user.get("role") is None:
            update_fields["role"] = "admin" if email in PERMANENT_ADMINS else "user"
            
        # Ensure skip_face exists
        if user.get("skip_face") is None:
            update_fields["skip_face"] = False
            
        # Ensure skip_location exists
        if user.get("skip_location") is None:
            update_fields["skip_location"] = False
            
        # Force permanent admins to be enabled and admin role
        if email in PERMANENT_ADMINS:
            update_fields["is_enabled"] = True
            update_fields["role"] = "admin"

        if update_fields:
            print(f"Updating {user.get('name')} ({email}): {update_fields}")
            await db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
            
    print("Migration complete.")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_users())
