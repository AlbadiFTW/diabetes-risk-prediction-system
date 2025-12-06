#!/usr/bin/env python3
\"\"\"
Test script for the Diabetes Risk Prediction API
This script tests all API endpoints to ensure they work correctly
\"\"\"

import requests
import json
import time
import sys

# API base URL
BASE_URL = "http://localhost:5000"

def test_health_check():
    \"\"\"Test the health check endpoint\"\"\"
    print("Testing health check endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f" Health check passed: {data}")
            return True
        else:
            print(f" Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(" Cannot connect to API. Make sure Flask is running on port 5000")
        return False
    except Exception as e:
        print(f" Health check error: {e}")
        return False

def test_single_prediction():
    \"\"\"Test single patient prediction\"\"\"
    print("\\nTesting single patient prediction...")
    
    # Test case 1: Low risk patient
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
            f"{BASE_URL}/predict",
            json=patient_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f" Single prediction successful:")
            print(f"  Risk Score: {data['riskScore']}%")
            print(f"  Risk Category: {data['riskCategory']}")
            print(f"  Confidence: {data['confidenceScore']}%")
            print(f"  Prediction: {'Diabetes' if data['prediction'] == 1 else 'No Diabetes'}")
            return True
        else:
            print(f" Single prediction failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f" Single prediction error: {e}")
        return False

def test_high_risk_prediction():
    \"\"\"Test high risk patient prediction\"\"\"
    print("\\nTesting high risk patient prediction...")
    
    # Test case 2: High risk patient
    patient_data = {
        "age": 45,
        "bmi": 32.1,
        "glucose": 150,
        "bloodPressure": 85,
        "insulin": 200,
        "skinThickness": 35,
        "pregnancies": 3,
        "familyHistory": 0.8
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/predict",
            json=patient_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f" High risk prediction successful:")
            print(f"  Risk Score: {data['riskScore']}%")
            print(f"  Risk Category: {data['riskCategory']}")
            print(f"  Confidence: {data['confidenceScore']}%")
            print(f"  Prediction: {'Diabetes' if data['prediction'] == 1 else 'No Diabetes'}")
            return True
        else:
            print(f" High risk prediction failed: {response.status_code}")
            return False
    except Exception as e:
        print(f" High risk prediction error: {e}")
        return False

def test_batch_prediction():
    \"\"\"Test batch prediction\"\"\"
    print("\\nTesting batch prediction...")
    
    patients_data = {
        "patients": [
            {
                "age": 31,
                "bmi": 26.6,
                "glucose": 85,
                "bloodPressure": 66,
                "insulin": 0,
                "skinThickness": 29,
                "pregnancies": 1,
                "familyHistory": 0.351
            },
            {
                "age": 45,
                "bmi": 32.1,
                "glucose": 150,
                "bloodPressure": 85,
                "insulin": 200,
                "skinThickness": 35,
                "pregnancies": 3,
                "familyHistory": 0.8
            },
            {
                "age": 28,
                "bmi": 24.5,
                "glucose": 95,
                "bloodPressure": 70,
                "insulin": 50,
                "skinThickness": 25,
                "pregnancies": 0,
                "familyHistory": 0.2
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/batch_predict",
            json=patients_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f" Batch prediction successful:")
            print(f"  Total patients: {data['total_patients']}")
            print(f"  Successful predictions: {data['successful_predictions']}")
            
            for i, prediction in enumerate(data['predictions']):
                if 'error' not in prediction:
                    print(f"  Patient {i+1}: {prediction['riskScore']}% risk ({prediction['riskCategory']})")
                else:
                    print(f"  Patient {i+1}: Error - {prediction['error']}")
            return True
        else:
            print(f" Batch prediction failed: {response.status_code}")
            return False
    except Exception as e:
        print(f" Batch prediction error: {e}")
        return False

def test_model_info():
    \"\"\"Test model info endpoint\"\"\"
    print("\\nTesting model info endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/model/info")
        
        if response.status_code == 200:
            data = response.json()
            print(f" Model info retrieved:")
            print(f"  Model type: {data['model_type']}")
            print(f"  Features: {len(data['features'])}")
            print(f"  Model loaded: {data['model_loaded']}")
            print(f"  Top 3 feature importance:")
            for i, (feature, importance) in enumerate(list(data['feature_importance'].items())[:3]):
                print(f"    {i+1}. {feature}: {importance:.4f}")
            return True
        else:
            print(f" Model info failed: {response.status_code}")
            return False
    except Exception as e:
        print(f" Model info error: {e}")
        return False

def test_invalid_input():
    \"\"\"Test API with invalid input\"\"\"
    print("\\nTesting invalid input handling...")
    
    # Test with missing fields
    invalid_data = {
        "age": 31,
        "bmi": 26.6
        # Missing required fields
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/predict",
            json=invalid_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 400:
            data = response.json()
            print(f" Invalid input handled correctly: {data['error']}")
            return True
        else:
            print(f" Invalid input not handled properly: {response.status_code}")
            return False
    except Exception as e:
        print(f" Invalid input test error: {e}")
        return False

def main():
    \"\"\"Run all tests\"\"\"
    print("=== Diabetes Risk Prediction API Tests ===")
    print()
    
    tests = [
        ("Health Check", test_health_check),
        ("Single Prediction (Low Risk)", test_single_prediction),
        ("Single Prediction (High Risk)", test_high_risk_prediction),
        ("Batch Prediction", test_batch_prediction),
        ("Model Info", test_model_info),
        ("Invalid Input Handling", test_invalid_input)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                print(f" {test_name} failed")
        except Exception as e:
            print(f" {test_name} failed with exception: {e}")
    
    print(f"\\n=== Test Results ===")
    print(f"Passed: {passed}/{total}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print(" All tests passed! API is working correctly.")
        return True
    else:
        print(" Some tests failed. Check the API and try again.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
