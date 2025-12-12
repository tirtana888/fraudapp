import requests
from requests.auth import HTTPBasicAuth

def test_analyze_candidate_fraud_risk():
    # Updated to use Firebase Functions emulator
    base_url = "http://127.0.0.1:5001/gen-lang-client-0226679970/europe-west1"
    endpoint = "/analyzeFraudRisk"
    url = base_url + endpoint

    auth = HTTPBasicAuth("superadmin@hiregood.com", "SuperAdmin123!")

    # Example payload based on API schema: role (string), transcript (array), ftAnswers (array)
    # Using sample data for transcript and ftAnswers to trigger a realistic fraud risk analysis.
    payload = {
        "role": "candidate",
        "transcript": [
            {"question": "Have you experienced any financial pressure recently?", "answer": "Yes, some unexpected medical bills."},
            {"question": "Do you have any opportunities at workplace that tempt unethical behavior?", "answer": "No, I strictly follow company policies."},
            {"question": "How do you rationalize bending rules in difficult cases?", "answer": "I don't; I believe rules are for everyone."}
        ],
        "ftAnswers": [
            {"pressure": 7.5, "opportunity": 2.0, "rationalization": 1.0},
            {"pressure": 6.0, "opportunity": 3.0, "rationalization": 2.5}
        ]
    }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, auth=auth, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not in JSON format"

    # Validate required keys in the response
    required_keys = ["scores", "riskLevel", "summary", "redFlags", "recommendation"]
    for key in required_keys:
        assert key in data, f"Response JSON missing key: {key}"

    scores = data["scores"]
    # Validate scores keys and their types
    for score_key in ["pressure", "opportunity", "rationalization"]:
        assert score_key in scores, f"'scores' missing '{score_key}'"
        assert isinstance(scores[score_key], (int, float)), f"'{score_key}' should be a number"

    # Validate riskLevel is one of the allowed enum values
    valid_risk_levels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert data["riskLevel"] in valid_risk_levels, f"riskLevel '{data['riskLevel']}' not in {valid_risk_levels}"

    # Validate summary is a non-empty string
    assert isinstance(data["summary"], str) and data["summary"].strip(), "summary should be a non-empty string"

    # Validate redFlags is a list
    assert isinstance(data["redFlags"], list), "redFlags should be a list"

    # Validate recommendation is a non-empty string
    assert isinstance(data["recommendation"], str) and data["recommendation"].strip(), "recommendation should be a non-empty string"


test_analyze_candidate_fraud_risk()