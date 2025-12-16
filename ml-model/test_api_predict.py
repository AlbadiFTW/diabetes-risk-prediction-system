#!/usr/bin/env python3
"""Test the /predict endpoint to identify the 500 error"""

import requests
import json

BASE_URL = "http://localhost:5000"

# Test data matching what the frontend sends
test_data = {
    "age": 31,
    "bmi": 26.6,
    "glucose": 85,
    "bloodPressure": 66,
    "insulin": 0,
    "skinThickness": 29,
    "pregnancies": 1,
    "familyHistory": 0.351,
    "gender": "male",
    "exerciseFrequency": "moderate",
    "smokingStatus": "never",
    "alcoholConsumption": "light",
    "familyHistoryFlag": False
}

print("=" * 60)
print("Testing /predict endpoint")
print("=" * 60)
print(f"\nSending request to: {BASE_URL}/predict")
print(f"Data: {json.dumps(test_data, indent=2)}")

try:
    response = requests.post(
        f"{BASE_URL}/predict",
        json=test_data,
        headers={"Content-Type": "application/json"},
        timeout=10
    )
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("\n✓ SUCCESS!")
        print(f"Risk Score: {result.get('riskScore')}%")
        print(f"Risk Category: {result.get('riskCategory')}")
        print(f"Confidence: {result.get('confidenceScore')}%")
    else:
        print(f"\n✗ ERROR: {response.status_code}")
        try:
            error_data = response.json()
            print(f"Error: {error_data.get('error', 'Unknown error')}")
            if 'details' in error_data:
                print(f"\nDetails:\n{error_data['details']}")
        except:
            print(f"Response: {response.text}")
            
except requests.exceptions.ConnectionError:
    print("\n✗ Connection Error: Make sure the API is running!")
    print("   Start it with: python app.py")
except Exception as e:
    print(f"\n✗ Error: {e}")
    import traceback
    traceback.print_exc()


















