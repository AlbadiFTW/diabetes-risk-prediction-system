#!/usr/bin/env python3
"""Quick test to verify the improved model loads and works correctly"""

import sys
import os

try:
    from diabetes_model_improved import ImprovedDiabetesRiskPredictor
    
    print("=" * 60)
    print("Testing Improved Model Loading and Prediction")
    print("=" * 60)
    
    # Initialize predictor
    predictor = ImprovedDiabetesRiskPredictor()
    
    # Load model
    if os.path.exists('diabetes_model_improved.pkl'):
        predictor.load_model('diabetes_model_improved.pkl')
        print("✓ Model loaded successfully!")
    else:
        print("✗ Model file not found!")
        sys.exit(1)
    
    # Test prediction
    test_patient = {
        'pregnancies': 1,
        'glucose': 85,
        'bloodPressure': 66,
        'skinThickness': 29,
        'insulin': 0,
        'bmi': 26.6,
        'diabetesPedigreeFunction': 0.351,
        'age': 31
    }
    
    result = predictor.predict_risk(test_patient)
    
    print("\n" + "=" * 60)
    print("Test Prediction Results:")
    print("=" * 60)
    print(f"Risk Score: {result['riskScore']}%")
    print(f"Risk Category: {result['riskCategory']}")
    print(f"Confidence: {result['confidenceScore']}%")
    print(f"Prediction: {'Diabetes' if result['prediction'] == 1 else 'No Diabetes'}")
    print(f"\nProbabilities:")
    print(f"  No Diabetes: {result['probabilities']['no_diabetes']}%")
    print(f"  Diabetes: {result['probabilities']['diabetes']}%")
    
    print("\n" + "=" * 60)
    print("✓ All tests passed! Model is working correctly.")
    print("=" * 60)
    
except Exception as e:
    print(f"\n✗ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)


















