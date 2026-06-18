import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

async def main():
    mongo_url = os.environ["MONGO_URL"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ["DB_NAME"]]
    
    papers = await db.papers.find().to_list(100)
    print("Total papers:", len(papers))
    for p in papers:
        print("Paper ID:", p.get("id"))
        print("Title:", p.get("title"))
        print("Paper Content (first 100 chars):", p.get("paper")[:100])
        print("Answer Key (first 100 chars):", p.get("answer_key")[:100] if p.get("answer_key") else "None")
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(main())
