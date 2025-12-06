# Diabetes Risk Prediction System - Machine Learning Model

This directory contains a complete machine learning system for diabetes risk prediction using the Pima Indians Diabetes Dataset.

## Features

- **Random Forest Classifier** for diabetes risk prediction
- **Data preprocessing** with missing value handling and normalization
- **Risk scoring** from 0-100% with confidence levels
- **Feature importance** analysis
- **Flask API** for real-time predictions
- **Model evaluation** with comprehensive metrics

## Files Structure

`
ml-model/
 requirements.txt          # Python dependencies
 diabetes_model.py        # Main ML model class
 app.py                   # Flask API server
 train_model.py          # Training script
 test_api.py             # API testing script
 README.md               # This file
 diabetes_model.pkl      # Trained model (created after training)
 model_metrics.json      # Model performance metrics
`

## Installation

1. **Install Python dependencies:**
   `ash
   pip install -r requirements.txt
   `

## Usage

### 1. Train the Model

First, train and save the model:

`ash
python train_model.py
`

This will:
- Download the Pima Indians Diabetes Dataset
- Preprocess the data (handle missing values, normalize features)
- Train a Random Forest Classifier
- Save the model as diabetes_model.pkl
- Generate performance metrics in model_metrics.json

### 2. Start the Flask API

After training, start the API server:

`ash
python app.py
`

The API will be available at http://localhost:5000

### 3. Test the API

Run the test script to verify everything works:

`ash
python test_api.py
`

## API Endpoints

### Health Check
- **GET** /health - Check if the API and model are loaded

### Predictions
- **POST** /predict - Predict diabetes risk for a single patient
- **POST** /batch_predict - Predict for multiple patients

### Model Management
- **GET** /model/info - Get model information and feature importance
- **POST** /model/retrain - Retrain the model with fresh data

## API Usage Examples

### Single Patient Prediction

`ash
curl -X POST http://localhost:5000/predict \\
  -H "Content-Type: application/json" \\
  -d '{
    "age": 31,
    "bmi": 26.6,
    "glucose": 85,
    "bloodPressure": 66,
    "insulin": 0,
    "skinThickness": 29,
    "pregnancies": 1,
    "familyHistory": 0.351
  }'
`

**Response:**
`json
{
  "riskScore": 15.2,
  "riskCategory": "Low",
  "confidenceScore": 84.8,
  "prediction": 0,
  "probabilities": {
    "no_diabetes": 84.8,
    "diabetes": 15.2
  },
  "featureImportance": {
    "Glucose": 0.2341,
    "BMI": 0.1987,
    "Age": 0.1567,
    "BloodPressure": 0.1234,
    "Insulin": 0.0987,
    "Pregnancies": 0.0876,
    "SkinThickness": 0.0654,
    "DiabetesPedigreeFunction": 0.0354
  },
  "model_info": {
    "model_type": "Random Forest Classifier",
    "features_used": ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI", "DiabetesPedigreeFunction", "Age"],
    "version": "1.0"
  }
}
`

### Batch Prediction

`ash
curl -X POST http://localhost:5000/batch_predict \\
  -H "Content-Type: application/json" \\
  -d '{
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
      }
    ]
  }'
`

## Input Parameters

| Parameter | Type | Description | Range |
|-----------|------|-------------|-------|
| ge | float | Patient's age in years | 21-81 |
| mi | float | Body Mass Index | 0-67 |
| glucose | float | Plasma glucose concentration | 0-200 |
| loodPressure | float | Diastolic blood pressure (mm Hg) | 0-122 |
| insulin | float | 2-Hour serum insulin (mu U/ml) | 0-846 |
| skinThickness | float | Triceps skin fold thickness (mm) | 0-99 |
| pregnancies | float | Number of pregnancies | 0-17 |
| amilyHistory | float | Diabetes pedigree function | 0-2.4 |

## Output Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| iskScore | float | Diabetes risk percentage (0-100%) |
| iskCategory | string | Risk level: "Low", "Moderate", "High", "Very High" |
| confidenceScore | float | Model confidence in prediction (0-100%) |
| prediction | int | Binary prediction: 0 (no diabetes), 1 (diabetes) |
| probabilities | object | Probability scores for each class |
| eatureImportance | object | Importance scores for each feature |

## Risk Categories

- **Low**: 0-25% risk
- **Moderate**: 25-50% risk  
- **High**: 50-75% risk
- **Very High**: 75-100% risk

## Model Performance

The Random Forest Classifier typically achieves:
- **Accuracy**: ~77-82%
- **Precision**: ~75-80%
- **Recall**: ~70-75%
- **F1-Score**: ~72-77%

## Dataset Information

The model is trained on the **Pima Indians Diabetes Dataset** which contains:
- **768 samples** of female patients of Pima Indian heritage
- **8 features** including glucose, blood pressure, BMI, age, etc.
- **Binary outcome** (diabetes/no diabetes)

## Development

### Adding New Features

To add new features to the model:

1. Update the eature_names list in DiabetesRiskPredictor
2. Modify the predict_risk method to handle new inputs
3. Update the API validation in pp.py
4. Retrain the model with 	rain_model.py

### Model Improvements

Potential improvements:
- **Feature Engineering**: Create new features from existing ones
- **Hyperparameter Tuning**: Use GridSearchCV for optimal parameters
- **Ensemble Methods**: Combine multiple models
- **Cross-validation**: Implement k-fold validation
- **Data Augmentation**: Generate synthetic samples for better training

## Troubleshooting

### Common Issues

1. **Model not found error**: Run python train_model.py first
2. **Import errors**: Install dependencies with pip install -r requirements.txt
3. **API connection refused**: Ensure Flask is running on port 5000
4. **Prediction errors**: Check input data format and ranges

### Logs and Debugging

- Check console output for training progress
- API logs show request/response details
- Model metrics saved in model_metrics.json

## License

This project is part of a diabetes risk prediction system for educational purposes.
