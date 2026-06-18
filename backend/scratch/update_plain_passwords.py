import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("--- STARTING PLAIN PASSWORD MIGRATION ---")
    
    users_mapping = {
        "ramesh@gmail.com": "Ramesh@2004",
        "srujay@gmail.com": "Shrujay@0000",
        "vardhan@gmail.com": "Vardhan@2008",
        "srakeshkumarrk2468@gmail.com": "Rakesh@2003",
        "rajabaksh@gmail.com": "Rajabaksh@123",
        "chamans7952@gmail.com": "Chaman@123",
        "mdabhinavkarthik@gmail.com": "Abhinav@123",
        "kswamytmk@gmail.com": "Krishna@123",
        "admin@frontlinebazaar.com": "Khasim@123",
        "rafik@transinfosystems.com": "Rafik@123",
        "john@example.com": "John@123",
        "admin@example.com": "Admin@123"
    }
    
    async for user in db.users.find({}):
        email = user.get("email", "").lower().strip()
        plain_pw = users_mapping.get(email, "Inkface@2026")
        
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"plain_password": plain_pw}}
        )
        print(f"Updated user {user.get('name')} ({email}) with plain_password: '{plain_pw}'")
        
    print("\n--- MIGRATION COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(main())
