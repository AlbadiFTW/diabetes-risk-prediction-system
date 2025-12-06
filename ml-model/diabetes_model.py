import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report, confusion_matrix
from sklearn.impute import SimpleImputer
import joblib
import requests
import os
from typing import Dict, List, Tuple, Any
import warnings
warnings.filterwarnings('ignore')

class DiabetesRiskPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.imputer = SimpleImputer(strategy='median')
        self.feature_names = [
            'Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness', 
            'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age'
        ]
        self.target_name = 'Outcome'
        
    def download_dataset(self) -> pd.DataFrame:
        """Download the Pima Indians Diabetes Dataset from UCI repository"""
        url = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv"
        
        # Column names for the dataset
        column_names = [
            'Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness', 
            'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome'
        ]
        
        try:
            # Try to download from UCI repository
            df = pd.read_csv(url, names=column_names)
            print(f"Dataset downloaded successfully. Shape: {df.shape}")
            return df
        except Exception as e:
            print(f"Error downloading dataset: {e}")
            # Create a sample dataset for demonstration
            print("Creating sample dataset for demonstration...")
            return self._create_sample_dataset()
    
    def _create_sample_dataset(self) -> pd.DataFrame:
        """Create a sample dataset for demonstration purposes"""
        np.random.seed(42)
        n_samples = 768
        
        # Generate realistic data based on Pima Indians Diabetes characteristics
        pregnancies = np.random.poisson(3.5, n_samples)
        pregnancies = np.clip(pregnancies, 0, 17)
        
        glucose = np.random.normal(120, 30, n_samples)
        glucose = np.clip(glucose, 0, 200)
        
        blood_pressure = np.random.normal(70, 12, n_samples)
        blood_pressure = np.clip(blood_pressure, 0, 122)
        
        skin_thickness = np.random.normal(20, 15, n_samples)
        skin_thickness = np.clip(skin_thickness, 0, 99)
        
        insulin = np.random.exponential(80, n_samples)
        insulin = np.clip(insulin, 0, 846)
        
        bmi = np.random.normal(32, 6, n_samples)
        bmi = np.clip(bmi, 0, 67)
        
        diabetes_pedigree = np.random.exponential(0.5, n_samples)
        diabetes_pedigree = np.clip(diabetes_pedigree, 0, 2.4)
        
        age = np.random.normal(33, 12, n_samples)
        age = np.clip(age, 21, 81)
        
        # Create outcome based on some logical rules
        outcome = np.zeros(n_samples)
        high_risk = (glucose > 140) | (bmi > 30) | (age > 50) | (blood_pressure > 90)
        outcome[high_risk] = np.random.binomial(1, 0.7, np.sum(high_risk))
        outcome[~high_risk] = np.random.binomial(1, 0.2, np.sum(~high_risk))
        
        df = pd.DataFrame({
            'Pregnancies': pregnancies,
            'Glucose': glucose,
            'BloodPressure': blood_pressure,
            'SkinThickness': skin_thickness,
            'Insulin': insulin,
            'BMI': bmi,
            'DiabetesPedigreeFunction': diabetes_pedigree,
            'Age': age,
            'Outcome': outcome
        })
        
        print(f"Sample dataset created. Shape: {df.shape}")
        return df
    
    def preprocess_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Preprocess the dataset: handle missing values, normalize features"""
        print("Preprocessing data...")
        
        # Handle missing values (replace 0s with NaN for certain columns)
        # In the Pima dataset, 0 values often represent missing data
        columns_to_check = ['Glucose', 'BloodPressure', 'SkinThickness', 'Insulin', 'BMI']
        for col in columns_to_check:
            df[col] = df[col].replace(0, np.nan)
        
        # Separate features and target
        X = df[self.feature_names].copy()
        y = df[self.target_name].copy()
        
        # Handle missing values
        X_imputed = pd.DataFrame(
            self.imputer.fit_transform(X),
            columns=X.columns,
            index=X.index
        )
        
        # Normalize features
        X_scaled = pd.DataFrame(
            self.scaler.fit_transform(X_imputed),
            columns=X_imputed.columns,
            index=X_imputed.index
        )
        
        print(f"Data preprocessing completed. Features shape: {X_scaled.shape}")
        return X_scaled, y
    
    def train_model(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
        """Train the Random Forest Classifier and evaluate performance"""
        print("Training Random Forest Classifier...")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Train model
        self.model = RandomForestClassifier(
            n_estimators=300,
            max_depth=12,
            min_samples_split=4,
            min_samples_leaf=1,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1
        )
        
        self.model.fit(X_train, y_train)
        
        # Make predictions
        y_pred = self.model.predict(X_test)
        y_pred_proba = self.model.predict_proba(X_test)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted')
        recall = recall_score(y_test, y_pred, average='weighted')
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        # Cross-validation
        cv_scores = cross_val_score(self.model, X_train, y_train, cv=5)
        
        metrics = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'cv_mean': cv_scores.mean(),
            'cv_std': cv_scores.std(),
            'classification_report': classification_report(y_test, y_pred),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
        }
        
        print(f"Model training completed!")
        print(f"Accuracy: {accuracy:.4f}")
        print(f"Precision: {precision:.4f}")
        print(f"Recall: {recall:.4f}")
        print(f"F1-Score: {f1:.4f}")
        print(f"CV Score: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        
        return metrics
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance from the trained model"""
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        importance = self.model.feature_importances_
        feature_importance = dict(zip(self.feature_names, importance))
        
        # Sort by importance
        sorted_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
        
        return sorted_importance
    
    def predict_risk(self, patient_data: Dict[str, float]) -> Dict[str, Any]:
        """Predict diabetes risk for a single patient"""
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        # Prepare input data
        input_data = np.array([
            patient_data.get('pregnancies', 0),
            patient_data.get('glucose', 0),
            patient_data.get('bloodPressure', 0),
            patient_data.get('skinThickness', 0),
            patient_data.get('insulin', 0),
            patient_data.get('bmi', 0),
            patient_data.get('diabetesPedigreeFunction', 0),
            patient_data.get('age', 0)
        ]).reshape(1, -1)
        
        # Handle missing values
        input_data = self.imputer.transform(input_data)
        
        # Normalize
        input_data = self.scaler.transform(input_data)
        
        # Make prediction
        prediction = self.model.predict(input_data)[0]
        probabilities = self.model.predict_proba(input_data)[0]
        
        # Calculate risk score (0-100%)
        risk_score = probabilities[1] * 100
        
        # Determine risk category
        if risk_score < 25:
            risk_category = "Low"
        elif risk_score < 50:
            risk_category = "Moderate"
        elif risk_score < 75:
            risk_category = "High"
        else:
            risk_category = "Very High"
        
        # Calculate confidence score
        confidence_score = max(probabilities) * 100
        
        # Get feature importance
        feature_importance = self.get_feature_importance()
        
        return {
            'riskScore': round(risk_score, 2),
            'riskCategory': risk_category,
            'confidenceScore': round(confidence_score, 2),
            'prediction': int(prediction),
            'probabilities': {
                'no_diabetes': round(probabilities[0] * 100, 2),
                'diabetes': round(probabilities[1] * 100, 2)
            },
            'featureImportance': feature_importance
        }
    
    def save_model(self, filepath: str = 'diabetes_model.pkl'):
        """Save the trained model and preprocessing objects"""
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'imputer': self.imputer,
            'feature_names': self.feature_names
        }
        
        joblib.dump(model_data, filepath)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str = 'diabetes_model.pkl'):
        """Load a trained model and preprocessing objects"""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.imputer = model_data['imputer']
        self.feature_names = model_data['feature_names']
        print(f"Model loaded from {filepath}")

def main():
    """Main function to train and save the model"""
    # Initialize predictor
    predictor = DiabetesRiskPredictor()
    
    # Download and preprocess data
    df = predictor.download_dataset()
    X, y = predictor.preprocess_data(df)
    
    # Train model
    metrics = predictor.train_model(X, y)
    
    # Save model
    predictor.save_model('diabetes_model.pkl')
    
    # Test prediction
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
    print("\nSample Prediction:")
    print(f"Risk Score: {prediction['riskScore']}%")
    print(f"Risk Category: {prediction['riskCategory']}")
    print(f"Confidence: {prediction['confidenceScore']}%")
    
    return predictor, metrics

if __name__ == "__main__":
    predictor, metrics = main()
