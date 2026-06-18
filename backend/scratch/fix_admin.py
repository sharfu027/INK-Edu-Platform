import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def fix_admin():
    mongodb_uri = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_uri)
    db_name = os.getenv("MONGODB_DB_NAME", "face_auth_db")
    db = client[db_name]
    
    email = "srujay@gmail.com"
    user = await db.users.find_one({"email": email})
    if user:
        print(f"Current user {email}: is_enabled={user.get('is_enabled')}, role={user.get('role')}")
        await db.users.update_one(
            {"email": email}, 
            {"$set": {"is_enabled": True, "role": "admin"}}
        )
        print(f"Updated {email} to ENABLED and ADMIN.")
    else:
        print(f"User {email} not found.")

if __name__ == "__main__":
    asyncio.run(fix_admin())
