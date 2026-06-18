import asyncio
import json
from motor.motor_asyncio import AsyncIOMotorClient
from bson import json_util

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    db = client["face_auth_db"]
    
    user = await db.users.find_one({"email": "mdabhinavkarthik@gmail.com"})
    print(json.dumps(user, default=json_util.default, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
