import requests
import os
from dotenv import load_dotenv

load_dotenv("C:/Users/srake/Downloads/Vidya-AI-main/Vidya-AI-main/backend/.env")
key = os.environ.get("EMERGENT_LLM_KEY")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
res = requests.get(url)
print(res.status_code)
if res.status_code == 200:
    for m in res.json().get("models", []):
        print(m.get("name"), m.get("displayName"))
else:
    print(res.text)
