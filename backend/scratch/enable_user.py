import pymongo

def enable_user(email):
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = pymongo.MongoClient(uri)
    db = client["face_auth_db"]
    res = db.users.update_one(
        {"email": email.strip().lower()},
        {"$set": {"is_enabled": True}}
    )
    print(f"Matched: {res.matched_count}, Modified: {res.modified_count}")

if __name__ == "__main__":
    enable_user("srakesh@gmail.com")
