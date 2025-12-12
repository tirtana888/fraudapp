import requests
from requests.auth import HTTPBasicAuth

def test_generate_ai_chatbot_response():
    # Updated to use Firebase Functions emulator
    base_url = "http://127.0.0.1:5001/gen-lang-client-0226679970/europe-west1"
    endpoint = "/generateAIResponse"
    url = base_url + endpoint

    headers = {
        "Content-Type": "application/json"
    }

    auth = HTTPBasicAuth("superadmin@hiregood.com", "SuperAdmin123!")

    payload = {
        "role": "interviewer",
        "message": "Can you describe a challenging project you worked on?",
        "history": [
            {"role": "interviewer", "message": "Hello, let's start the interview."},
            {"role": "candidate", "message": "Thank you, I am ready."}
        ],
        "candidateData": {
            "candidateId": "12345",
            "name": "John Doe",
            "positionApplied": "Software Engineer"
        }
    }

    try:
        response = requests.post(url, json=payload, headers=headers, auth=auth, timeout=30)
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Unexpected status code: {response.status_code}"

    try:
        resp_json = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert isinstance(resp_json, dict), "Response JSON is not a dictionary"
    assert "success" in resp_json, "'success' field missing in response"
    assert isinstance(resp_json["success"], bool), "'success' field is not boolean"
    assert resp_json["success"] is True, "API call did not succeed"

    assert "response" in resp_json, "'response' field missing in response"
    assert isinstance(resp_json["response"], str), "'response' field is not a string"
    assert len(resp_json["response"].strip()) > 0, "'response' field is empty"

    assert "model" in resp_json, "'model' field missing in response"
    assert isinstance(resp_json["model"], str), "'model' field is not a string"
    assert len(resp_json["model"].strip()) > 0, "'model' field is empty"

test_generate_ai_chatbot_response()