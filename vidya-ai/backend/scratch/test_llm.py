import asyncio
import os
import sys
from pathlib import Path

# Add backend directory to path so local imports work
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

async def main():
    key = os.environ.get("EMERGENT_LLM_KEY")
    print("EMERGENT_LLM_KEY:", key)
    
    # Try gemini
    try:
        chat = LlmChat(
            api_key=key,
            session_id="test-session",
            system_message="You are a helpful assistant.",
        ).with_model("gemini", "gemini-1.5-flash")
        
        print("Sending message to gemini...")
        reply = await chat.send_message(UserMessage(text="Say hello in 5 words."))
        print("Reply:", reply)
    except Exception as e:
        print("Gemini error:", e)

    # Try openai gpt-5.2
    try:
        chat = LlmChat(
            api_key=key,
            session_id="test-session",
            system_message="You are a helpful assistant.",
        ).with_model("openai", "gpt-5.2")
        
        print("Sending message to openai/gpt-5.2...")
        reply = await chat.send_message(UserMessage(text="Say hello in 5 words."))
        print("Reply:", reply)
    except Exception as e:
        print("OpenAI error:", e)

if __name__ == "__main__":
    asyncio.run(main())
