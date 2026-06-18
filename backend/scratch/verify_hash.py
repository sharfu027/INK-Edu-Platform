import bcrypt

def verify():
    hash_str = "$2b$12$HM0mOqu1OC/UPTKctu/mEuu87tDqDqW9y8UoR7kFj/6kZf3K" # We need the full hash
    # Wait, let's pull Vardhan's full hash from DB first
    pass

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    vardhan = await db.users.find_one({"email": "vardhan@gmail.com"})
    v_hash = vardhan.get("password_hash") if vardhan else None
    
    print(f"Vardhan's full hash: {v_hash}")
    
    # Check candidates
    if v_hash:
        candidates = ["Vardhan@2008", "Rakesh2005@", "Vardhan@123", "Inkface@2026"]
        for c in candidates:
            matched = bcrypt.checkpw(c.encode("utf-8"), v_hash.encode("utf-8"))
            print(f"  Does it match '{c}'? {matched}")
    else:
        print("No hash found for Vardhan")
        
    # Check other users
    ramesh = await db.users.find_one({"email": "ramesh@gmail.com"})
    r_hash = ramesh.get("password_hash") if ramesh else None
    print(f"Ramesh's full hash: {r_hash}")
    if r_hash:
        for c in ["Ramesh@2004", "Rakesh2005@"]:
            matched = bcrypt.checkpw(c.encode("utf-8"), r_hash.encode("utf-8"))
            print(f"  Does it match '{c}'? {matched}")
    else:
        print("No hash found for Ramesh")

if __name__ == "__main__":
    asyncio.run(main())
