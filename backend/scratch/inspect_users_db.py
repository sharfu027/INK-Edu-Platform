import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("--- DETAILED USERS ---")
    async for user in db.users.find({}):
        print(f"Name: {user.get('name')} | Email: {user.get('email')} | EmpId: {user.get('employee_id')} | Hash: {user.get('password_hash')[:15] if user.get('password_hash') else 'None'}")

if __name__ == "__main__":
    asyncio.run(main())
