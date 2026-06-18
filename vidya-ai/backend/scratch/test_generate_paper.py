import asyncio
import os
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

from server import call_llm

async def main():
    system_msg = "You are Vidya AI, an expert exam paper designer."
    prompt = "Create a short 5-mark quiz on photosynthesis with 2 MCQs."
    
    start_time = time.time()
    try:
        reply = await call_llm(system_msg, prompt, "test-session")
        duration = time.time() - start_time
        print(f"Success! Duration: {duration:.2f} seconds")
        print("Reply:")
        print(reply[:500])
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
