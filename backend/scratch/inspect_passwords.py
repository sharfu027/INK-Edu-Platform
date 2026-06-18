import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("--- USER PASSWORDS REPORT ---")
    async for u in db.users.find({}):
        print(f"Name: {u.get('name')} | Email: {u.get('email')}")
        print(f"  -> password_plain: {u.get('password_plain')}")
        print(f"  -> plain_password: {u.get('plain_password')}")
        print(f"  -> password_hash:  {u.get('password_hash')[:25] if u.get('password_hash') else 'None'}")
        print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())
