import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    uri = "mongodb+srv://rakesh_rk:Rakesh2005@faceauth.jvni6bv.mongodb.net/?appName=faceauth"
    client = AsyncIOMotorClient(uri)
    
    print("--- DATABASES ---")
    dbs = await client.list_database_names()
    for db_name in dbs:
        print(f"Database: {db_name}")
        db = client[db_name]
        colls = await db.list_collection_names()
        print(f"  Collections: {colls}")
        for coll in colls:
            count = await db[coll].count_documents({})
            print(f"    -> {coll}: {count} docs")
            
if __name__ == "__main__":
    asyncio.run(main())
