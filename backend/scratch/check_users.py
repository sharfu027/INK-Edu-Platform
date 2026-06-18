import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load from backend dir
load_dotenv("d:/Intern/face-auth/backend/.env")

async def check_users():
    mongo_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGODB_DB_NAME")
    if not mongo_url or not db_name:
        print("Error: MONGODB_URL or MONGODB_DB_NAME not found in .env")
        return
        
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Connecting to {db_name}...")
    
    users = await db.users.find().to_list(100)
    print(f"Found {len(users)} users:")
    for u in users:
        print(f"- {u.get('name')} ({u.get('email')}) | ID: {u.get('employee_id')} | Role: {u.get('role')} | Enabled: {u.get('is_enabled')} | SkipFace: {u.get('skip_face')} | SkipLoc: {u.get('skip_location')}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(check_users())
