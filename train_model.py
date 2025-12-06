#!/usr/bin/env python3
"""
Training script for the Diabetes Risk Prediction Model
Run this script to train and save the model before starting the API
"""

from diabetes_model import DiabetesRiskPredictor
import json
import os

def main():
    print("=== Diabetes Risk Prediction Model Training ===")
    print()
    
    # Initialize predictor
    predictor = DiabetesRiskPredictor()
    
    # Download and preprocess data
    print("Step 1: Downloading and preprocessing data...")
    df = predictor.download_dataset()
    X, y = predictor.preprocess_data(df)
    
    # Train model
    print("\nStep 2: Training Random Forest Classifier...")
    metrics = predictor.train_model(X, y)
    
    # Save model
    print("\nStep 3: Saving model...")
    predictor.save_model('diabetes_model.pkl')
    
    # Save metrics
    with open('model_metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)
    print("Model metrics saved to model_metrics.json")
    
    # Test prediction
    print("\nStep 4: Testing prediction...")
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
    print("\nSample Prediction Results:")
    print(f"Risk Score: {prediction['riskScore']}%")
    print(f"Risk Category: {prediction['riskCategory']}")
    print(f"Confidence: {prediction['confidenceScore']}%")
    print(f"Prediction: {'Diabetes' if prediction['prediction'] == 1 else 'No Diabetes'}")
    
    # Display feature importance
    print("\nFeature Importance:")
    for feature, importance in prediction['featureImportance'].items():
        print(f"  {feature}: {importance:.4f}")
    
    print("\n=== Training Complete ===")
    print("Model saved as 'diabetes_model.pkl'")
    print("You can now start the Flask API with: python app.py")
    
    return predictor, metrics

if __name__ == "__main__":
    predictor, metrics = main()