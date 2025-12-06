import requests, time, tempfile, textwrap
import json

API_BASE = "https://api.eunha.icu"
REGISTRY_URL = "217350599014.dkr.ecr.ap-northeast-2.amazonaws.com/blue-final-faas-app"
WORKSPACE = "ws-default"

code = textwrap.dedent("""
    from spin_sdk.http import IncomingHandler as BaseIncomingHandler, Response

    class IncomingHandler(BaseIncomingHandler):
        def handle_request(self, request):
            return Response(
                200,
                {"content-type": "text/plain"},
                bytes("Hello from Spin!", "utf-8")
            )
""").encode()

with tempfile.NamedTemporaryFile(suffix=".py", delete=False) as f:
    f.write(code); f.flush()
    files = {"file": ("test.py", open(f.name, "rb"))}
    data = {
        "registry_url": REGISTRY_URL,
        "workspace_id": WORKSPACE,
        "username": "",  # IRSA 강제
        "password": "",
        "tag": "sha256",
    }
    print("-- build-and-push 요청 --")
    try:
        resp = requests.post(f"{API_BASE}/api/v1/build-and-push", files=files, data=data, timeout=30)
        print("status", resp.status_code)
        resp.raise_for_status()
        task_id = resp.json()["task_id"]
        print(f"Task ID: {task_id}")
    except Exception as e:
        print(e)
        exit(1)

print("-- 폴링 --")
for i in range(1, 15):
    time.sleep(3)
    try:
        r = requests.get(f"{API_BASE}/api/v1/tasks/{task_id}", params={"workspace_id": WORKSPACE}, timeout=10)
        payload = r.json()
        status = payload.get("status")
        result = payload.get("result", {})
        image_url = result.get("image_url") if result else None
        print(f"{i}: status={status}, image_url={image_url}")
        
        if status in ("completed", "done", "failed"):
            print("Final Result:", payload)
            break
    except Exception as e:
        print(f"Polling error: {e}")
