import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.model_selection import train_test_split, cross_val_score, RandomizedSearchCV, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    classification_report, confusion_matrix, roc_auc_score, 
    roc_curve, precision_recall_curve, average_precision_score
)
from sklearn.impute import SimpleImputer
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
import joblib
import requests
import os
from typing import Dict, List, Tuple, Any
import warnings
warnings.filterwarnings('ignore')

class ImprovedDiabetesRiskPredictor:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.imputer = SimpleImputer(strategy='median')
        self.feature_names = [
            'Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness', 
            'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age'
        ]
        self.enhanced_feature_names = None  # Will include engineered features
        self.target_name = 'Outcome'
        
    def download_pima_dataset(self) -> pd.DataFrame:
        """Download the Pima Indians Diabetes Dataset from UCI repository"""
        url = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv"
        
        column_names = [
            'Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness', 
            'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome'
        ]
        
        try:
            df = pd.read_csv(url, names=column_names)
            print(f"✓ Pima Indians Dataset downloaded. Shape: {df.shape}")
            return df
        except Exception as e:
            print(f"✗ Error downloading Pima dataset: {e}")
            return None
    
    def download_early_stage_diabetes_dataset(self) -> pd.DataFrame:
        """Download Early Stage Diabetes Risk Prediction Dataset from UCI"""
        # This is a different diabetes dataset with similar features
        url = "https://archive.ics.uci.edu/ml/machine-learning-databases/00529/diabetes_data_upload.csv"
        
        try:
            df = pd.read_csv(url)
            # This dataset has different column names, need to map them
            # If the structure is different, we'll handle it
            print(f"✓ Early Stage Diabetes Dataset downloaded. Shape: {df.shape}")
            return df
        except Exception as e:
            print(f"✗ Error downloading Early Stage dataset: {e}")
            return None
    
    def download_combined_datasets(self) -> pd.DataFrame:
        """Download and combine multiple trusted diabetes datasets"""
        print("=" * 60)
        print("Downloading Multiple Trusted Diabetes Datasets...")
        print("=" * 60)
        
        datasets = []
        
        # 1. Pima Indians Diabetes Dataset (Primary - 768 samples)
        pima_df = self.download_pima_dataset()
        if pima_df is not None:
            datasets.append(("Pima Indians", pima_df))
        
        # 2. Try to download additional datasets
        # Note: Some datasets may require different preprocessing
        # For now, we'll focus on Pima as it's the most compatible
        
        if not datasets:
            print("⚠ No datasets downloaded. Creating sample dataset...")
            return self._create_sample_dataset()
        
        # Combine all datasets
        if len(datasets) == 1:
            print(f"\n✓ Using {datasets[0][0]} dataset")
            return datasets[0][1]
        
        # If multiple datasets, combine them
        combined_df = pd.concat([df for _, df in datasets], ignore_index=True)
        print(f"\n✓ Combined {len(datasets)} datasets. Total samples: {combined_df.shape[0]}")
        return combined_df
    
    def download_dataset(self) -> pd.DataFrame:
        """Main method to download dataset(s) - uses combined approach"""
        return self.download_combined_datasets()
    
    def _create_sample_dataset(self) -> pd.DataFrame:
        """Create a sample dataset for demonstration purposes"""
        np.random.seed(42)
        n_samples = 768
        
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
    
    def engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create new features from existing ones to improve model performance"""
        df = df.copy()
        
        # Glucose to BMI ratio (important for diabetes risk)
        df['Glucose_BMI_Ratio'] = df['Glucose'] / (df['BMI'] + 1e-6)
        
        # Age and BMI interaction (older age + high BMI = higher risk)
        df['Age_BMI_Interaction'] = df['Age'] * df['BMI'] / 100
        
        # Blood pressure categories (handle edge cases)
        df['BP_Category'] = pd.cut(
            df['BloodPressure'], 
            bins=[0, 80, 90, 100, 200], 
            labels=[0, 1, 2, 3],
            include_lowest=True
        ).astype(float).fillna(1.0)  # Default to category 1 if out of range
        
        # Glucose categories (normal, prediabetic, diabetic)
        df['Glucose_Category'] = pd.cut(
            df['Glucose'],
            bins=[0, 100, 126, 300],
            labels=[0, 1, 2],
            include_lowest=True
        ).astype(float).fillna(0.0)  # Default to normal if out of range
        
        # BMI categories
        df['BMI_Category'] = pd.cut(
            df['BMI'],
            bins=[0, 18.5, 25, 30, 100],
            labels=[0, 1, 2, 3],
            include_lowest=True
        ).astype(float).fillna(2.0)  # Default to overweight if out of range
        
        # Metabolic risk score (composite feature)
        df['Metabolic_Risk'] = (
            (df['Glucose'] > 100).astype(int) +
            (df['BMI'] > 25).astype(int) +
            (df['BloodPressure'] > 80).astype(int) +
            (df['Age'] > 45).astype(int)
        )
        
        # Insulin resistance indicator
        df['Insulin_Glucose_Ratio'] = df['Insulin'] / (df['Glucose'] + 1e-6)
        
        return df
    
    def preprocess_data(self, df: pd.DataFrame, engineer_features: bool = True) -> Tuple[pd.DataFrame, pd.Series]:
        """Preprocess the dataset with optional feature engineering"""
        print("Preprocessing data...")
        
        # Feature engineering
        if engineer_features:
            df = self.engineer_features(df)
            print("Feature engineering completed.")
        
        # Handle missing values (replace 0s with NaN for certain columns)
        columns_to_check = ['Glucose', 'BloodPressure', 'SkinThickness', 'Insulin', 'BMI']
        for col in columns_to_check:
            if col in df.columns:
                df[col] = df[col].replace(0, np.nan)
        
        # Separate features and target
        feature_cols = [col for col in df.columns if col != self.target_name]
        X = df[feature_cols].copy()
        y = df[self.target_name].copy()
        
        # Store feature names
        self.enhanced_feature_names = feature_cols
        
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
    
    def train_model(self, X: pd.DataFrame, y: pd.Series, use_hyperparameter_tuning: bool = True) -> Dict[str, Any]:
        """Train an improved model with hyperparameter tuning and ensemble methods"""
        print("Training Improved Diabetes Risk Predictor...")
        
        # Split data with stratification
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Apply SMOTE for class imbalance (only on training data)
        print("Applying SMOTE to handle class imbalance...")
        smote = SMOTE(random_state=42)
        X_train_balanced, y_train_balanced = smote.fit_resample(X_train, y_train)
        print(f"Balanced training set: {X_train_balanced.shape[0]} samples (was {X_train.shape[0]})")
        
        if use_hyperparameter_tuning:
            print("Performing hyperparameter tuning...")
            # Hyperparameter grid for Random Forest
            rf_param_grid = {
                'n_estimators': [200, 300, 400, 500],
                'max_depth': [10, 12, 15, 20, None],
                'min_samples_split': [2, 4, 6],
                'min_samples_leaf': [1, 2, 4],
                'max_features': ['sqrt', 'log2', None],
                'class_weight': ['balanced', 'balanced_subsample']
            }
            
            # Create base models
            rf_base = RandomForestClassifier(random_state=42, n_jobs=-1)
            gb_base = GradientBoostingClassifier(random_state=42)
            
            # Randomized search for Random Forest (faster than GridSearch)
            rf_search = RandomizedSearchCV(
                rf_base, rf_param_grid, 
                n_iter=50,  # Number of parameter settings sampled
                cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
                scoring='roc_auc',
                n_jobs=-1,
                random_state=42,
                verbose=1
            )
            
            rf_search.fit(X_train_balanced, y_train_balanced)
            print(f"Best RF params: {rf_search.best_params_}")
            print(f"Best RF CV score: {rf_search.best_score_:.4f}")
            
            # Train Gradient Boosting with good defaults
            gb_base.set_params(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.1,
                subsample=0.8
            )
            gb_base.fit(X_train_balanced, y_train_balanced)
            
            # Create ensemble model
            self.model = VotingClassifier(
                estimators=[
                    ('rf', rf_search.best_estimator_),
                    ('gb', gb_base)
                ],
                voting='soft',  # Use probabilities
                weights=[2, 1]  # Give more weight to RF
            )
        else:
            # Use improved defaults without tuning
            rf_model = RandomForestClassifier(
                n_estimators=400,
                max_depth=15,
                min_samples_split=4,
                min_samples_leaf=2,
                max_features='sqrt',
                class_weight='balanced_subsample',
                random_state=42,
                n_jobs=-1
            )
            
            gb_model = GradientBoostingClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.1,
                subsample=0.8,
                random_state=42
            )
            
            self.model = VotingClassifier(
                estimators=[('rf', rf_model), ('gb', gb_model)],
                voting='soft',
                weights=[2, 1]
            )
        
        # Train the ensemble
        print("Training ensemble model...")
        self.model.fit(X_train_balanced, y_train_balanced)
        
        # Make predictions
        y_pred = self.model.predict(X_test)
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        
        # Calculate comprehensive metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted')
        recall = recall_score(y_test, y_pred, average='weighted')
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        # ROC-AUC and PR-AUC (better for imbalanced datasets)
        roc_auc = roc_auc_score(y_test, y_pred_proba)
        pr_auc = average_precision_score(y_test, y_pred_proba)
        
        # Cross-validation on full training set
        cv_scores = cross_val_score(
            self.model, X_train_balanced, y_train_balanced, 
            cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
            scoring='roc_auc',
            n_jobs=-1
        )
        
        # Get ROC and PR curves
        fpr, tpr, _ = roc_curve(y_test, y_pred_proba)
        precision_curve, recall_curve, _ = precision_recall_curve(y_test, y_pred_proba)
        
        metrics = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'roc_auc': roc_auc,
            'pr_auc': pr_auc,
            'cv_mean': cv_scores.mean(),
            'cv_std': cv_scores.std(),
            'classification_report': classification_report(y_test, y_pred),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
            'roc_curve': {'fpr': fpr.tolist(), 'tpr': tpr.tolist()},
            'pr_curve': {'precision': precision_curve.tolist(), 'recall': recall_curve.tolist()}
        }
        
        print(f"\n{'='*50}")
        print(f"Model training completed!")
        print(f"{'='*50}")
        print(f"Accuracy: {accuracy:.4f}")
        print(f"Precision: {precision:.4f}")
        print(f"Recall: {recall:.4f}")
        print(f"F1-Score: {f1:.4f}")
        print(f"ROC-AUC: {roc_auc:.4f}")
        print(f"PR-AUC: {pr_auc:.4f}")
        print(f"CV ROC-AUC: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        print(f"{'='*50}\n")
        
        return metrics
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance from the trained model"""
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        # Get importance from Random Forest (first estimator in ensemble)
        if hasattr(self.model, 'named_estimators_'):
            rf_model = self.model.named_estimators_['rf']
            importance = rf_model.feature_importances_
        else:
            # Fallback if structure is different
            importance = self.model.estimators_[0].feature_importances_
        
        feature_names = self.enhanced_feature_names or self.feature_names
        feature_importance = dict(zip(feature_names, importance))
        
        # Sort by importance
        sorted_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
        
        return sorted_importance
    
    def predict_risk(self, patient_data: Dict[str, float]) -> Dict[str, Any]:
        """Predict diabetes risk for a single patient"""
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        # Prepare base features
        base_features = np.array([
            patient_data.get('pregnancies', 0),
            patient_data.get('glucose', 0),
            patient_data.get('bloodPressure', 0),
            patient_data.get('skinThickness', 0),
            patient_data.get('insulin', 0),
            patient_data.get('bmi', 0),
            patient_data.get('diabetesPedigreeFunction', 0),
            patient_data.get('age', 0)
        ])
        
        # Create DataFrame for feature engineering
        df_input = pd.DataFrame([{
            'Pregnancies': base_features[0],
            'Glucose': base_features[1],
            'BloodPressure': base_features[2],
            'SkinThickness': base_features[3],
            'Insulin': base_features[4],
            'BMI': base_features[5],
            'DiabetesPedigreeFunction': base_features[6],
            'Age': base_features[7]
        }])
        
        # Apply feature engineering
        df_engineered = self.engineer_features(df_input)
        
        # Get all features in correct order
        feature_cols = self.enhanced_feature_names
        if feature_cols is None:
            raise ValueError("Enhanced feature names not set. Model may not be properly loaded.")
        
        # Ensure all required columns exist
        missing_cols = [col for col in feature_cols if col not in df_engineered.columns]
        if missing_cols:
            raise ValueError(f"Missing feature columns after engineering: {missing_cols}")
        
        input_data = df_engineered[feature_cols].values
        
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
    
    def save_model(self, filepath: str = 'diabetes_model_improved.pkl'):
        """Save the trained model and preprocessing objects"""
        if self.model is None:
            raise ValueError("Model not trained yet!")
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'imputer': self.imputer,
            'feature_names': self.feature_names,
            'enhanced_feature_names': self.enhanced_feature_names
        }
        
        joblib.dump(model_data, filepath)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str = 'diabetes_model_improved.pkl'):
        """Load a trained model and preprocessing objects"""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.imputer = model_data['imputer']
        self.feature_names = model_data['feature_names']
        self.enhanced_feature_names = model_data.get('enhanced_feature_names', self.feature_names)
        print(f"Model loaded from {filepath}")

def main():
    """Main function to train and save the improved model"""
    # Initialize predictor
    predictor = ImprovedDiabetesRiskPredictor()
    
    # Download and preprocess data
    df = predictor.download_dataset()
    X, y = predictor.preprocess_data(df, engineer_features=True)
    
    # Train model with hyperparameter tuning
    print("\nTraining with hyperparameter tuning (this may take a few minutes)...")
    metrics = predictor.train_model(X, y, use_hyperparameter_tuning=True)
    
    # Save model
    predictor.save_model('diabetes_model_improved.pkl')
    
    # Save metrics
    import json
    with open('model_metrics_improved.json', 'w') as f:
        # Convert numpy arrays to lists for JSON serialization
        metrics_serializable = {k: v for k, v in metrics.items() if k not in ['roc_curve', 'pr_curve']}
        json.dump(metrics_serializable, f, indent=2)
    print("Model metrics saved to model_metrics_improved.json")
    
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

