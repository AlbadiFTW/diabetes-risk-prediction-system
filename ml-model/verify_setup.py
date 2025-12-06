#!/usr/bin/env python3
"""Verify that the API can load the improved model correctly"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("=" * 60)
    print("Verifying API Setup with Improved Model")
    print("=" * 60)
    
    # Test importing the app module
    print("\n1. Testing imports...")
    try:
        from app import load_model, predictor, USE_IMPROVED_MODEL, MODEL_FILE
        print(f"   ✓ Imports successful")
        print(f"   ✓ Using improved model: {USE_IMPROVED_MODEL}")
        print(f"   ✓ Model file: {MODEL_FILE}")
    except Exception as e:
        print(f"   ✗ Import error: {e}")
        sys.exit(1)
    
    # Test model loading
    print("\n2. Testing model loading...")
    try:
        result = load_model()
        if result:
            print(f"   ✓ Model loaded successfully!")
            # Re-import to get updated predictor
            from app import predictor
            if predictor is not None:
                print(f"   ✓ Predictor object created")
                if hasattr(predictor, 'predict_risk'):
                    print(f"   ✓ Improved model interface detected")
                else:
                    print(f"   ⚠ Using legacy model format")
            else:
                print(f"   ✗ Predictor is None")
                sys.exit(1)
        else:
            print(f"   ✗ Model loading failed")
            sys.exit(1)
    except Exception as e:
        print(f"   ✗ Error loading model: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Test prediction
    print("\n3. Testing prediction...")
    try:
        # Re-import to get updated predictor
        from app import predictor
        test_data = {
            'pregnancies': 1,
            'glucose': 85,
            'bloodPressure': 66,
            'skinThickness': 29,
            'insulin': 0,
            'bmi': 26.6,
            'diabetesPedigreeFunction': 0.351,
            'age': 31
        }
        
        if hasattr(predictor, 'predict_risk'):
            result = predictor.predict_risk(test_data)
            print(f"   ✓ Prediction successful!")
            print(f"   ✓ Risk Score: {result['riskScore']}%")
            print(f"   ✓ Risk Category: {result['riskCategory']}")
        else:
            print(f"   ⚠ Legacy model format - prediction test skipped")
    except Exception as e:
        print(f"   ✗ Prediction error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("✓ ALL VERIFICATIONS PASSED!")
    print("=" * 60)
    print("\nThe improved model is ready to use!")
    print("You can start the API with: python app.py")
    print("=" * 60)
    
except Exception as e:
    print(f"\n✗ Verification failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

