import requests
from requests.auth import HTTPBasicAuth

def test_send_email_invitation():
    # Updated to use Firebase Functions emulator
    base_url = "http://127.0.0.1:5001/gen-lang-client-0226679970/europe-west1"
    endpoint = "/sendEmail"
    url = base_url + endpoint
    auth = HTTPBasicAuth("superadmin@hiregood.com", "SuperAdmin123!")
    headers = {
        "Content-Type": "application/json"
    }

    test_payloads = [
        {
            "templateId": "candidate_invitation",
            "to": "candidate@example.com",
            "variables": {
                "candidateName": "John Doe",
                "jobTitle": "Software Engineer",
                "interviewDate": "2025-01-15T10:00:00Z"
            }
        },
        {
            "templateId": "interview_invitation",
            "to": "interviewer@example.com",
            "variables": {
                "interviewerName": "Jane Smith",
                "candidateName": "John Doe",
                "interviewDate": "2025-01-15T10:00:00Z",
                "location": "Zoom"
            }
        }
    ]

    for payload in test_payloads:
        try:
            response = requests.post(url, json=payload, headers=headers, auth=auth, timeout=30)
        except requests.RequestException as e:
            assert False, f"Request failed: {e}"

        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
        try:
            data = response.json()
        except ValueError:
            assert False, "Response is not a valid JSON"

        assert "success" in data, "Response JSON missing 'success' key"
        assert isinstance(data["success"], bool), "'success' key should be a boolean"
        assert data["success"] is True, "Email sending reported as unsuccessful"

test_send_email_invitation()