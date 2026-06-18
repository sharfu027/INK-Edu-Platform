import requests
import os
from dotenv import load_dotenv

load_dotenv("C:/Users/srake/Downloads/Vidya-AI-main/Vidya-AI-main/backend/.env")
key = os.environ.get("EMERGENT_LLM_KEY")

def test_url(url):
    payload = {
        "contents": [{"parts": [{"text": "Hello"}]}]
    }
    headers = {"Content-Type": "application/json"}
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"URL: {url} -> Status: {res.status_code}")
        if res.status_code == 200:
            print(res.json()["candidates"][0]["content"]["parts"][0]["text"])
        else:
            print(res.text[:300])
    except Exception as e:
        print(f"Error: {e}")

test_url(f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={key}")
test_url(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={key}")
