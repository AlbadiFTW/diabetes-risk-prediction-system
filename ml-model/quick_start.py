#!/usr/bin/env python3
"""
Quick start script for the Diabetes Risk Prediction System
This script will start the Flask API server
"""

import subprocess
import sys
import time
import requests
import os

def check_dependencies():
    """Check if all required packages are installed"""
    try:
        import pandas
        import numpy
        import sklearn
        import flask
        import joblib
        print("✓ All dependencies are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def check_model():
    """Check if the model file exists"""
    if os.path.exists('diabetes_model.pkl'):
        print("✓ Model file found")
        return True
    else:
        print("✗ Model file not found")
        print("Please run the training first or use the existing model")
        return False

def start_api():
    """Start the Flask API server"""
    print("Starting Flask API server...")
    print("API will be available at: http://localhost:5000")
    print("Press Ctrl+C to stop the server")
    print("-" * 50)
    
    try:
        # Start the Flask app
        from app import app
        app.run(host='0.0.0.0', port=5000, debug=True)
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Error starting server: {e}")

def test_api():
    """Test the API if it's running"""
    try:
        response = requests.get("http://localhost:5000/health", timeout=5)
        if response.status_code == 200:
            print("✓ API is running and healthy")
            return True
        else:
            print("✗ API is not responding correctly")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ API is not running")
        return False
    except Exception as e:
        print(f"✗ Error testing API: {e}")
        return False

def main():
    print("=== Diabetes Risk Prediction System - Quick Start ===")
    print()
    
    # Check dependencies
    if not check_dependencies():
        return False
    
    # Check model
    if not check_model():
        print("Note: You can still start the API, but predictions may not work")
    
    print()
    print("Starting the API server...")
    print("Once started, you can test it by running: python simple_test.py")
    print()
    
    # Start the API
    start_api()
    
    return True

if __name__ == "__main__":
    main()
