import requests
import json

print("=== Testing Diabetes Risk Prediction API ===")

# Test health check
try:
    response = requests.get("http://localhost:5000/health")
    if response.status_code == 200:
        print("✓ Health check passed")
        print(f"Response: {response.json()}")
    else:
        print(f"✗ Health check failed: {response.status_code}")
except Exception as e:
    print(f"✗ Cannot connect to API: {e}")
    print("Make sure Flask is running on port 5000")
    exit(1)

# Test prediction
patient_data = {
    "age": 31,
    "bmi": 26.6,
    "glucose": 85,
    "bloodPressure": 66,
    "insulin": 0,
    "skinThickness": 29,
    "pregnancies": 1,
    "familyHistory": 0.351
}

try:
    response = requests.post(
        "http://localhost:5000/predict",
        json=patient_data,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✓ Prediction successful:")
        print(f"  Risk Score: {data['riskScore']}%")
        print(f"  Risk Category: {data['riskCategory']}")
        print(f"  Confidence: {data['confidenceScore']}%")
        print(f"  Prediction: {'Diabetes' if data['prediction'] == 1 else 'No Diabetes'}")
    else:
        print(f"✗ Prediction failed: {response.status_code}")
        print(f"  Response: {response.text}")
except Exception as e:
    print(f"✗ Prediction error: {e}")

print("=== Test Complete ===")
