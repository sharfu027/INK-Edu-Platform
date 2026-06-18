import asyncio
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# Unique passwords for each employee
EMPLOYEE_PASSWORDS = {
    "mdabhinavkarthik@gmail.com": "Abhinav@2024",
    "rajabaksh@gmail.com":        "Rajabhaxa@2024",
    "chamans7952@gmail.com":      "Chaman@7952",
    "john@example.com":           "John@2024",
    "admin@example.com":          "Admin@2024",
    "vardhan@gmail.com":          "Vardhan@2008",    # Already correct - keep as is
    "kswamytmk@gmail.com":        "Krishna@2024",
    "srujay@gmail.com":           "Shrujay@0000",    # Already correct - keep as is
    "ramesh@gmail.com":           "Ramesh@2004",     # Already correct - keep as is
    "admin@frontlinebazaar.com":  "Khasim@2024",
    "rafik@transinfosystems.com": "Rafik@2024",
    "srakeshkumarrk2468@gmail.com": "Rakesh@2003",  # Already correct - keep as is
}

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("=" * 60)
    print("SETTING UNIQUE PASSWORDS FOR ALL EMPLOYEES")
    print("=" * 60)
    
    for email, new_password in EMPLOYEE_PASSWORDS.items():
        user = await db.users.find_one({"email": email})
        if not user:
            print(f"[SKIP] User not found: {email}")
            continue
            
        name = user.get("name", "Unknown")
        current_hash = user.get("password_hash", "")
        
        # Check if this password already matches the current hash
        already_correct = False
        try:
            already_correct = bcrypt.checkpw(new_password.encode("utf-8"), current_hash.encode("utf-8"))
        except:
            pass
            
        if already_correct:
            # Just update the plain_password fields, hash is already correct
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "plain_password": new_password,
                    "password_plain": new_password
                }}
            )
            print(f"[OK] {name} ({email}) -> '{new_password}' (hash already matched, updated plain fields)")
        else:
            # Generate new hash AND update plain_password
            new_hash = hash_password(new_password)
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "password_hash": new_hash,
                    "plain_password": new_password,
                    "password_plain": new_password
                }}
            )
            print(f"[RESET] {name} ({email}) -> '{new_password}' (NEW hash generated)")
    
    # Final verification
    print("\n" + "=" * 60)
    print("VERIFICATION - ALL PASSWORDS NOW:")
    print("=" * 60)
    
    async for u in db.users.find({}):
        name = u.get("name", "Unknown")
        email = u.get("email", "")
        pwd_hash = u.get("password_hash", "")
        plain_pw = u.get("plain_password", "")
        
        match = bcrypt.checkpw(plain_pw.encode("utf-8"), pwd_hash.encode("utf-8"))
        status = "PASS" if match else "FAIL"
        print(f"[{status}] {name} ({email}) -> Password: '{plain_pw}'")

    print("\n" + "=" * 60)
    print("ALL DONE - Every employee now has a unique password!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
