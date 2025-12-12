import requests
from requests.auth import HTTPBasicAuth

def test_parse_cv_document_with_ai():
    # Updated to use Firebase Functions emulator
    base_url = "http://127.0.0.1:5001/gen-lang-client-0226679970/europe-west1"
    endpoint = "/parseCVWithMistral"
    url = base_url + endpoint
    auth = HTTPBasicAuth("superadmin@hiregood.com", "SuperAdmin123!")
    headers = {
        "Content-Type": "application/json"
    }

    # Sample CV URL for testing - assuming a placeholder valid URL
    payload = {
        "cvUrl": "https://example.com/sample-cv.pdf",
        "sessionId": "test-session-parse-cv-001"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, auth=auth, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

    data = response.json()
    assert isinstance(data, dict), "Response is not a JSON object"
    assert data.get("success") is True, "API did not return success=True"

    parsed_data = data.get("parsedData")
    assert isinstance(parsed_data, dict), "parsedData is missing or not a dict"

    # Validate presence and types of required fields
    assert "fullName" in parsed_data and isinstance(parsed_data["fullName"], str) and parsed_data["fullName"], "fullName missing or invalid"
    assert "email" in parsed_data and isinstance(parsed_data["email"], str) and parsed_data["email"], "email missing or invalid"
    assert "phone" in parsed_data and isinstance(parsed_data["phone"], str) and parsed_data["phone"], "phone missing or invalid"
    assert "experience" in parsed_data and isinstance(parsed_data["experience"], list), "experience missing or not a list"
    assert "education" in parsed_data and isinstance(parsed_data["education"], list), "education missing or not a list"
    assert "skills" in parsed_data and isinstance(parsed_data["skills"], list), "skills missing or not a list"

test_parse_cv_document_with_ai()