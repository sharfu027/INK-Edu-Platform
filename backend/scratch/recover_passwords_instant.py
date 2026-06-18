import asyncio
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("--- INSTANT PASSWORD RECOVERY AND RE-SYNC ---")
    
    candidates = [
        "Rakesh2005@",
        "Vardhan@2008",
        "Shrujay@0000",
        "Ramesh@2004",
        "Rakesh@2003"
    ]
    
    async for u in db.users.find({}):
        name = u.get("name", "")
        email = u.get("email", "")
        pwd_hash = u.get("password_hash")
        
        if not pwd_hash:
            print(f"Skipping {name} ({email}) - no password hash.")
            continue
            
        matched_pw = None
        for cand in candidates:
            try:
                if bcrypt.checkpw(cand.encode("utf-8"), pwd_hash.encode("utf-8")):
                    matched_pw = cand
                    break
            except Exception:
                continue
                
        if matched_pw:
            await db.users.update_one(
                {"_id": u["_id"]},
                {"$set": {
                    "plain_password": matched_pw,
                    "password_plain": matched_pw
                }}
            )
            print(f"[RECOVERED] {name} ({email}) -> '{matched_pw}'")
        else:
            print(f"[FAILED] Could not recover for {name} ({email}) with standard candidates.")
            
    print("\n--- INSTANT SYNC COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(main())
