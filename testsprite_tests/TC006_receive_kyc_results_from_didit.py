import requests
from requests.auth import HTTPBasicAuth

def test_receive_kyc_results_from_didit():
    # Updated to use Firebase Functions emulator
    base_url = "http://127.0.0.1:5001/gen-lang-client-0226679970/europe-west1"
    endpoint = "/diditWebhook"
    url = f"{base_url}{endpoint}"

    auth = HTTPBasicAuth("superadmin@hiregood.com", "SuperAdmin123!")
    headers = {
        "Content-Type": "application/json"
    }

    # Sample valid payload representing a typical KYC webhook call from Didit
    payload = {
        "session_number": "sess_1234567890",
        "status": "completed",
        "webhook_type": "kyc_result"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, auth=auth, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    # The PRD doesn't specify response schema, so perform basic validation on returned content-type and response body
    content_type = response.headers.get("Content-Type", "")
    assert "application/json" in content_type, "Response Content-Type is not application/json"

    try:
        data = response.json()
    except Exception as e:
        assert False, f"Response is not valid JSON: {e}"

    # Validate expected fields in response if any or at least the presence of a success flag or message
    # Since no response schema given, check if response contains indication of success or acknowledgement
    # In absence of specification, accept any valid JSON response

    # Optionally for security: verify sensitive info not echoed back
    # Just an example; adapt as needed
    assert isinstance(data, dict), "Response JSON is not an object"

test_receive_kyc_results_from_didit()
