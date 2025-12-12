import requests
from requests.auth import HTTPBasicAuth

# Updated to use Firebase Functions emulator
BASE_URL = "http://127.0.0.1:5001/gen-lang-client-0226679970/europe-west1"
AUTH = HTTPBasicAuth("superadmin@hiregood.com", "SuperAdmin123!")
TIMEOUT = 30

def test_initiate_background_check():
    url = f"{BASE_URL}/initiateBackgroundCheck"
    payload = {
        "sessionId": "test-session-001",
        "candidateName": "Test Candidate",
        "candidateEmail": "test.candidate@example.com"
    }
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, auth=AUTH, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    assert isinstance(data, dict), "Response JSON is not an object"
    assert "success" in data, "Response missing 'success' key"
    assert isinstance(data["success"], bool), "'success' is not a boolean"
    assert data["success"] is True, "Background check initiation was not successful"

    assert "verificationLink" in data, "Response missing 'verificationLink' key"
    verification_link = data["verificationLink"]
    assert isinstance(verification_link, str), "'verificationLink' is not a string"
    assert verification_link.startswith("http"), "Verification link does not appear to be a valid URL"

test_initiate_background_check()