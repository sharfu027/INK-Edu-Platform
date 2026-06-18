import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("--- SYNCING REAL PASSWORDS FROM DATABASE ---")
    
    async for u in db.users.find({}):
        email = u.get("email", "").lower().strip()
        
        # If password_plain exists in the document, use it as the real plaintext password!
        if u.get("password_plain"):
            real_pw = u.get("password_plain")
        else:
            # Fallback/Keep the existing plain_password if it's set
            real_pw = u.get("plain_password")
            if not real_pw:
                real_pw = "Rakesh2005@" # Default matching their main hash
        
        await db.users.update_one(
            {"_id": u["_id"]},
            {"$set": {
                "plain_password": real_pw,
                "password_plain": real_pw
            }}
        )
        print(f"Synced {u.get('name')} ({email}) to real password: '{real_pw}'")
        
    print("\n--- SYNC COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(main())
