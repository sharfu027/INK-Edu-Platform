import asyncio
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    print("--- PREPARING DATABASE FOR TESTING ---")
    
    # 1. Ramesh
    ramesh_pw = "Ramesh@2004"
    ramesh_hash = hash_password(ramesh_pw)
    await db.users.update_one(
        {"email": "ramesh@gmail.com"},
        {
            "$set": {
                "password_hash": ramesh_hash,
                "plain_password": ramesh_pw,
                "is_enabled": True,
                "skip_location": False,  # MUST BE FALSE to test location mismatch!
                "has_face_data": True,
                "liveness_verified": True
            }
        }
    )
    print("[SUCCESS] Configured ramesh@gmail.com with password 'Ramesh@2004', enabled account, and set skip_location=False.")

    # 2. Shrujay
    shrujay_pw = "Shrujay@0000"
    shrujay_hash = hash_password(shrujay_pw)
    await db.users.update_one(
        {"email": "srujay@gmail.com"},
        {
            "$set": {
                "password_hash": shrujay_hash,
                "plain_password": shrujay_pw,
                "is_enabled": True,
                "skip_location": False,  # MUST BE FALSE to test location mismatch!
                "has_face_data": True,
                "liveness_verified": True
            }
        }
    )
    print("[SUCCESS] Configured srujay@gmail.com with password 'Shrujay@0000', enabled account, and set skip_location=False.")

    # 3. Vardhan
    vardhan_pw = "Vardhan@2008"
    vardhan_hash = hash_password(vardhan_pw)
    await db.users.update_one(
        {"email": "vardhan@gmail.com"},
        {
            "$set": {
                "password_hash": vardhan_hash,
                "plain_password": vardhan_pw,
                "is_enabled": True,
                "skip_location": False,  # MUST BE FALSE to test location mismatch!
                "has_face_data": True,
                "liveness_verified": True
            }
        }
    )
    print("[SUCCESS] Configured vardhan@gmail.com with password 'Vardhan@2008', enabled account, and set skip_location=False.")

    # 4. Rakesh (create/upsert if missing)
    rakesh_email = "srakeshkumarrk2468@gmail.com"
    rakesh_pw = "Rakesh@2003"
    rakesh_hash = hash_password(rakesh_pw)
    
    existing_rakesh = await db.users.find_one({"email": rakesh_email})
    if existing_rakesh:
        await db.users.update_one(
            {"email": rakesh_email},
            {
                "$set": {
                    "password_hash": rakesh_hash,
                    "plain_password": rakesh_pw,
                    "is_enabled": True,
                    "skip_location": False,
                    "has_face_data": True,
                    "liveness_verified": True
                }
            }
        )
        print(f"[SUCCESS] Updated existing user {rakesh_email} with password 'Rakesh@2003'.")
    else:
        # Create new Rakesh user
        user_doc = {
            "name": "Rakesh",
            "email": rakesh_email,
            "phone": "9999999999",
            "password_hash": rakesh_hash,
            "plain_password": rakesh_pw,
            "designation": "Software Developer",
            "profession": "Developer",
            "joining_date": "2026-05-17",
            "role": "user",
            "is_enabled": True,
            "skip_location": False,
            "has_face_data": True,
            "liveness_verified": True,
            "registered_location": {"latitude": 13.0, "longitude": 77.0},  # Bangalore coordinates
            "hours_per_day": 8.0,
            "weekly_off": "Sunday"
        }
        await db.users.insert_one(user_doc)
        print(f"[SUCCESS] Created NEW user {rakesh_email} with password 'Rakesh@2003', enabled account, and set skip_location=False.")

    print("\n--- DATABASE SYNCHRONIZATION COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(main())
