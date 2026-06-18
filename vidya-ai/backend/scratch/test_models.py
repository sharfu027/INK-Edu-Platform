import requests
import os
from dotenv import load_dotenv

load_dotenv("C:/Users/srake/Downloads/Vidya-AI-main/Vidya-AI-main/backend/.env")
key = os.environ.get("EMERGENT_LLM_KEY")

def test_model(model_name):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
    payload = {
        "contents": [{"parts": [{"text": "Generate a short 5-mark quiz on photosynthesis with 2 MCQs in JSON format."}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    headers = {"Content-Type": "application/json"}
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=30)
        print(f"Model: {model_name} -> Status: {res.status_code}")
        if res.status_code == 200:
            print(res.json()["candidates"][0]["content"]["parts"][0]["text"][:200])
        else:
            print(res.text)
    except Exception as e:
        print(f"Error for {model_name}: {e}")

test_model("gemini-1.5-flash")
test_model("gemini-2.5-flash")
