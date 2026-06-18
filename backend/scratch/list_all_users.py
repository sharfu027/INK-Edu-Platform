import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("--- ALL USERS IN DB ---")
    async for user in db.users.find({}):
        print(f"Name: {user.get('name')} | Email: {user.get('email')} | Role: {user.get('role')} | Is Enabled: {user.get('is_enabled')} | Registered Location: {user.get('registered_location')}")

if __name__ == "__main__":
    asyncio.run(main())
