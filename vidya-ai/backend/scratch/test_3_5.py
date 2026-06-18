import requests
import os
import time
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
    start = time.time()
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=30)
        dur = time.time() - start
        print(f"Model: {model_name} -> Status: {res.status_code}, Duration: {dur:.2f}s")
    except Exception as e:
        print(f"Error for {model_name}: {e}")

test_model("gemini-2.5-flash")
test_model("gemini-3.5-flash")
