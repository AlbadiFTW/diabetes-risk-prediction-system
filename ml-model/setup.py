#!/usr/bin/env python3
\"\"\"
Setup script for the Diabetes Risk Prediction System
This script installs dependencies, trains the model, and provides usage instructions
\"\"\"

import subprocess
import sys
import os
import time

def run_command(command, description):
    \"\"\"Run a command and handle errors\"\"\"
    print(f"\\n{description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f" {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f" {description} failed:")
        print(f"  Error: {e.stderr}")
        return False

def check_python_version():
    \"\"\"Check if Python version is compatible\"\"\"
    print("Checking Python version...")
    if sys.version_info < (3, 8):
        print(" Python 3.8 or higher is required")
        print(f"  Current version: {sys.version}")
        return False
    else:
        print(f" Python version {sys.version.split()[0]} is compatible")
        return True

def install_dependencies():
    \"\"\"Install required Python packages\"\"\"
    return run_command("pip install -r requirements.txt", "Installing dependencies")

def train_model():
    \"\"\"Train the machine learning model\"\"\"
    return run_command("python train_model.py", "Training the model")

def test_model():
    \"\"\"Test the trained model\"\"\"
    print("\\nTesting the trained model...")
    try:
        from diabetes_model import DiabetesRiskPredictor
        
        # Load the trained model
        predictor = DiabetesRiskPredictor()
        predictor.load_model('diabetes_model.pkl')
        
        # Test with sample data
        sample_patient = {
            'pregnancies': 1,
            'glucose': 85,
            'bloodPressure': 66,
            'skinThickness': 29,
            'insulin': 0,
            'bmi': 26.6,
            'diabetesPedigreeFunction': 0.351,
            'age': 31
        }
        
        prediction = predictor.predict_risk(sample_patient)
        print(f" Model test successful:")
        print(f"  Risk Score: {prediction['riskScore']}%")
        print(f"  Risk Category: {prediction['riskCategory']}")
        print(f"  Confidence: {prediction['confidenceScore']}%")
        return True
        
    except Exception as e:
        print(f" Model test failed: {e}")
        return False

def main():
    \"\"\"Main setup function\"\"\"
    print("=== Diabetes Risk Prediction System Setup ===")
    print("This script will set up the complete ML system for diabetes risk prediction.")
    print()
    
    # Check Python version
    if not check_python_version():
        print("\\nPlease upgrade Python to version 3.8 or higher and try again.")
        return False
    
    # Install dependencies
    if not install_dependencies():
        print("\\nFailed to install dependencies. Please check your Python environment.")
        return False
    
    # Train model
    if not train_model():
        print("\\nFailed to train the model. Please check the error messages above.")
        return False
    
    # Test model
    if not test_model():
        print("\\nModel training completed but testing failed. The model may not work correctly.")
        return False
    
    print("\\n=== Setup Complete! ===")
    print("\\nNext steps:")
    print("1. Start the Flask API server:")
    print("   python app.py")
    print()
    print("2. In another terminal, test the API:")
    print("   python test_api.py")
    print()
    print("3. The API will be available at: http://localhost:5000")
    print()
    print("API Endpoints:")
    print("- GET  /health           - Health check")
    print("- POST /predict          - Single patient prediction")
    print("- POST /batch_predict    - Multiple patients prediction")
    print("- GET  /model/info       - Model information")
    print("- POST /model/retrain    - Retrain model")
    print()
    print("Example API usage:")
    print('curl -X POST http://localhost:5000/predict \\\\')
    print('  -H "Content-Type: application/json" \\\\')
    print('  -d \'{"age": 31, "bmi": 26.6, "glucose": 85, "bloodPressure": 66, "insulin": 0, "skinThickness": 29, "pregnancies": 1, "familyHistory": 0.351}\'')
    print()
    print("For more information, see README.md")
    
    return True

if __name__ == "__main__":
    success = main()
    if not success:
        print("\\nSetup failed. Please check the error messages above and try again.")
        sys.exit(1)
    else:
        print("\\n Setup completed successfully!")
        sys.exit(0)
