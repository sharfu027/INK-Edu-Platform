import asyncio
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("=" * 70)
    print("FULL PASSWORD AUDIT")
    print("=" * 70)
    
    hash_map = {}
    
    async for u in db.users.find({}):
        name = u.get("name", "Unknown")
        email = u.get("email", "")
        pwd_hash = u.get("password_hash", "")
        plain_pw = u.get("plain_password", "")
        pw_plain = u.get("password_plain", "")
        
        print(f"\nName:           {name}")
        print(f"Email:          {email}")
        print(f"password_hash:  {pwd_hash[:50]}...")
        print(f"plain_password: {plain_pw}")
        print(f"password_plain: {pw_plain}")
        
        # Verify: does the stored plain_password actually match the hash?
        if plain_pw and pwd_hash:
            match = bcrypt.checkpw(plain_pw.encode("utf-8"), pwd_hash.encode("utf-8"))
            print(f"VERIFY: Does '{plain_pw}' match hash? -> {match}")
        
        if pwd_hash not in hash_map:
            hash_map[pwd_hash] = []
        hash_map[pwd_hash].append(name)

    print("\n" + "=" * 70)
    print("HASH UNIQUENESS CHECK")
    print("=" * 70)
    
    for h, names in hash_map.items():
        if len(names) > 1:
            print(f"\n!! DUPLICATE HASH: {len(names)} users share SAME password:")
            print(f"   Hash: {h[:40]}...")
            for n in names:
                print(f"   -> {n}")
        else:
            print(f"OK Unique hash for: {names[0]}")

if __name__ == "__main__":
    asyncio.run(main())
