import asyncio
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("--- STARTING INTELLIGENT PASSWORD RECOVERY SYSTEM ---")
    
    async for u in db.users.find({}):
        name = u.get("name", "")
        email = u.get("email", "")
        pwd_hash = u.get("password_hash")
        
        if not pwd_hash:
            print(f"Skipping {name} ({email}) - no password hash found.")
            continue
            
        # Let's dynamically generate intelligent candidate passwords for this user!
        name_parts = [p.strip() for p in name.replace(" ", "@").replace("_", "@").split("@") if p.strip()]
        email_parts = [p.strip() for p in email.replace("@", ".").split(".") if p.strip()]
        
        candidates = set()
        
        # Add baseline patterns
        candidates.add("Rakesh2005@")
        candidates.add("Rakesh2003")
        candidates.add("Rakesh@2003")
        candidates.add("Ramesh@2004")
        candidates.add("Shrujay@0000")
        candidates.add("Vardhan@2008")
        candidates.add("Inkface@2026")
        
        # Word stems
        stems = set()
        for p in name_parts + email_parts:
            if len(p) >= 3:
                stems.add(p.lower())
                stems.add(p.capitalize())
                stems.add(p.upper())
                
        # Suffixes
        suffixes = [
            "@123", "123", "@2003", "@2004", "@2005", "@2008", "@0000", "2005@", "2003@", "2008@", "2004@",
            "@2026", "@2024", "@2025", "@1234", "12345", "@12345", "123456", "@123456", "@7952", "7952", "2005", "2003"
        ]
        
        for stem in stems:
            for suffix in suffixes:
                candidates.add(f"{stem}{suffix}")
                candidates.add(f"{stem}{suffix}".replace("@", ""))
                candidates.add(f"{stem}@{suffix}")
                
        # Try brute force matching
        matched_pw = None
        for candidate in candidates:
            try:
                if bcrypt.checkpw(candidate.encode("utf-8"), pwd_hash.encode("utf-8")):
                    matched_pw = candidate
                    break
            except Exception:
                continue
                
        if matched_pw:
            # We found the real registered password! Update the database!
            await db.users.update_one(
                {"_id": u["_id"]},
                {"$set": {
                    "plain_password": matched_pw,
                    "password_plain": matched_pw
                }}
            )
            print(f"[SUCCESS] RECOVERED password for {name} ({email}) -> '{matched_pw}'")
        else:
            # If no recovery possible, keep whatever is currently correct or set a sensible pattern
            current_plain = u.get("password_plain") or u.get("plain_password") or "Rakesh2005@"
            print(f"[WARNING] Could not match hash for {name} ({email}). Current fallback: '{current_plain}'")

    print("\n--- RECOVERY COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(main())
