from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os
from typing import Dict, Any, Tuple, List
from cors_config import configure_cors, get_limiter, require_api_key, rate_limit

# Try to import improved model, fallback to original
try:
    from diabetes_model_improved import ImprovedDiabetesRiskPredictor as DiabetesRiskPredictor
    print("✓ Using Improved Diabetes Risk Predictor")
    USE_IMPROVED_MODEL = True
    MODEL_FILE = 'diabetes_model_improved.pkl'
except ImportError:
    from diabetes_model import DiabetesRiskPredictor
    print("⚠ Using Standard Diabetes Risk Predictor (improved model not available)")
    USE_IMPROVED_MODEL = False
    MODEL_FILE = 'diabetes_model.pkl'

app = Flask(__name__)
configure_cors(app)  # Configure CORS, Rate Limiting, and Security Headers

# Get the limiter instance after configuration
limiter = get_limiter()

# Global predictor instance
predictor = None

RISK_THRESHOLDS: List[Tuple[float, str]] = [
    (20, "Low"),
    (50, "Moderate"),
    (75, "High"),
    (101, "Very High"),
]

def clamp(value: float, min_value: float = 0, max_value: float = 100) -> float:
    return max(min_value, min(max_value, value))

def categorize_risk(score: float) -> str:
    for threshold, label in RISK_THRESHOLDS:
        if score < threshold:
            return label
    return "Very High"

def parse_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0

def apply_contextual_adjustments(base_score: float, payload: Dict[str, Any], context: Dict[str, Any]) -> Tuple[float, int]:
    adjustments = 0.0
    healthy_indicators = 0

    bmi = payload.get("bmi")
    if bmi:
        if 18.5 <= bmi <= 24.9:
            adjustments -= 7
            healthy_indicators += 1
        elif bmi >= 30:
            adjustments += 10
        elif bmi >= 25:
            adjustments += 5

    glucose = payload.get("glucose")
    if glucose:
        if 70 <= glucose <= 99:
            adjustments -= 6
            healthy_indicators += 1
        elif glucose >= 126:
            adjustments += 10
        elif glucose >= 110:
            adjustments += 5

    hba1c = payload.get("hba1c")
    if hba1c:
        if hba1c < 5.7:
            adjustments -= 4
            healthy_indicators += 1
        elif hba1c >= 6.5:
            adjustments += 10

    systolic = payload.get("systolicBP")
    diastolic = payload.get("diastolicBP")
    if systolic and diastolic:
        if systolic < 120 and diastolic < 80:
            adjustments -= 3
            healthy_indicators += 1
        elif systolic >= 140 or diastolic >= 90:
            adjustments += 6

    exercise = (context.get("exerciseFrequency") or "").lower()
    if exercise in {"moderate", "heavy"}:
        adjustments -= 4
        healthy_indicators += 1
    elif exercise in {"none", "light"}:
        adjustments += 2

    smoking = (context.get("smokingStatus") or "").lower()
    if smoking == "never":
        adjustments -= 2
        healthy_indicators += 1
    elif smoking == "current":
        adjustments += 5

    alcohol = (context.get("alcoholConsumption") or "").lower()
    if alcohol in {"none", "light"}:
        adjustments -= 1
    elif alcohol == "heavy":
        adjustments += 3

    if not context.get("familyHistoryFlag"):
        adjustments -= 2
        healthy_indicators += 1

    adjusted_score = clamp(base_score + adjustments)
    return adjusted_score, healthy_indicators

def generate_personalized_recommendations(payload: Dict[str, Any], context: Dict[str, Any]) -> List[str]:
    recommendations: List[str] = []
    risk_score = payload.get("riskScore", 0)  # Get risk score if available
    bmi = payload.get("bmi")
    glucose = payload.get("glucose")
    hba1c = payload.get("hba1c")
    systolic = payload.get("systolicBP")
    diastolic = payload.get("diastolicBP")
    age = payload.get("age", 0)
    insulin = payload.get("insulin")
    
    # Check if patient has diagnosed diabetes
    diabetes_status = (context.get("diabetesStatus") or "").lower()
    has_diabetes = diabetes_status in {"type1", "type2", "gestational", "other"}
    is_prediabetic = diabetes_status == "prediabetic"
    
    # Priority-based recommendations based on risk level and critical factors
    critical_issues = []
    positive_factors = []
    
    # Check BMI
    if bmi:
        if bmi < 18.5:
            critical_issues.append(("BMI", f"Your BMI of {bmi:.1f} is below the healthy range. Consult with your healthcare provider about maintaining a healthy weight."))
        elif bmi > 30:
            critical_issues.append(("BMI", f"Your BMI of {bmi:.1f} indicates obesity, which significantly increases diabetes risk. Consider a structured weight management program with your doctor."))
        elif bmi > 24.9:
            recommendations.append(f"Your BMI of {bmi:.1f} is above the healthy range. Aim to lose 5-10% of your current weight through diet and exercise to reduce diabetes risk.")
        else:
            positive_factors.append(("BMI", f"Your BMI of {bmi:.1f} is in the healthy range. Maintain this through balanced nutrition and regular activity."))
    
    # Check Glucose (highest priority)
    if glucose:
        if has_diabetes:
            # Management-focused recommendations for diagnosed patients
            if glucose >= 180:
                critical_issues.append(("Glucose", f"Your glucose of {glucose:.0f} mg/dL is very high. Check your medication, diet, and activity. Contact your doctor if this persists."))
            elif glucose >= 140:
                critical_issues.append(("Glucose", f"Your glucose of {glucose:.0f} mg/dL is elevated. Review your meal plan, medication timing, and consider increasing physical activity."))
            elif glucose < 70:
                critical_issues.append(("Glucose", f"Your glucose of {glucose:.0f} mg/dL is low (hypoglycemia). Treat immediately with 15g of fast-acting carbs. Review medication dosages with your doctor."))
            elif 70 <= glucose <= 130:
                positive_factors.append(("Glucose", f"Your glucose of {glucose:.0f} mg/dL is in the target range. Excellent control! Continue your current management plan."))
            else:
                recommendations.append(f"Your glucose of {glucose:.0f} mg/dL is slightly above target. Small adjustments to diet or activity may help.")
        else:
            # Prevention-focused recommendations for at-risk patients
            if glucose >= 126:
                critical_issues.append(("Glucose", f"Your fasting glucose of {glucose:.0f} mg/dL is in the diabetes range. Schedule immediate medical consultation and follow-up testing."))
            elif glucose >= 100:
                critical_issues.append(("Glucose", f"Your fasting glucose of {glucose:.0f} mg/dL indicates prediabetes. Focus on reducing sugar intake, increasing physical activity, and regular monitoring."))
            elif glucose < 70:
                recommendations.append(f"Your glucose of {glucose:.0f} mg/dL is low. Ensure regular meals and consult your doctor if you experience symptoms of hypoglycemia.")
            else:
                positive_factors.append(("Glucose", f"Your fasting glucose of {glucose:.0f} mg/dL is excellent. Continue maintaining healthy eating habits."))
    
    # Check HbA1c
    if hba1c:
        if has_diabetes:
            # Management-focused: Target is <7% for most, <6.5% for some
            if hba1c >= 9.0:
                critical_issues.append(("HbA1c", f"Your HbA1c of {hba1c:.1f}% is very high and indicates poor control. Urgent review of medication, diet, and lifestyle is needed. Contact your healthcare team immediately."))
            elif hba1c >= 8.0:
                critical_issues.append(("HbA1c", f"Your HbA1c of {hba1c:.1f}% is above target. Work with your doctor to adjust your management plan—this may include medication changes, dietary modifications, or increased activity."))
            elif hba1c >= 7.0:
                recommendations.append(f"Your HbA1c of {hba1c:.1f}% is slightly above the target of <7%. Small improvements in diet and exercise can help reach your goal.")
            else:
                positive_factors.append(("HbA1c", f"Your HbA1c of {hba1c:.1f}% is at target! Excellent diabetes control. Continue your current management plan."))
        else:
            # Prevention-focused
            if hba1c >= 6.5:
                critical_issues.append(("HbA1c", f"Your HbA1c of {hba1c:.1f}% indicates diabetes. Work with your healthcare team to develop a comprehensive management plan."))
            elif hba1c >= 5.7:
                critical_issues.append(("HbA1c", f"Your HbA1c of {hba1c:.1f}% is in the prediabetes range. Implement lifestyle changes now to prevent progression to diabetes."))
            else:
                positive_factors.append(("HbA1c", f"Your HbA1c of {hba1c:.1f}% shows good glucose control. Keep up your healthy habits."))
    
    # Check Blood Pressure
    if systolic and diastolic:
        if systolic >= 140 or diastolic >= 90:
            critical_issues.append(("Blood Pressure", f"Your blood pressure of {systolic:.0f}/{diastolic:.0f} mmHg indicates hypertension. This increases diabetes risk—consult your doctor for management."))
        elif systolic >= 130 or diastolic >= 80:
            recommendations.append(f"Your blood pressure of {systolic:.0f}/{diastolic:.0f} mmHg is elevated. Reduce sodium intake, increase physical activity, and monitor regularly.")
        else:
            positive_factors.append(("Blood Pressure", f"Your blood pressure of {systolic:.0f}/{diastolic:.0f} mmHg is optimal. Maintain this through healthy lifestyle choices."))
    
    # Check Insulin
    if insulin:
        if insulin > 25:
            recommendations.append(f"Your insulin level of {insulin:.1f} µU/mL is elevated, suggesting possible insulin resistance. Focus on weight management and regular exercise.")
        elif insulin < 2:
            recommendations.append(f"Your insulin level of {insulin:.1f} µU/mL is low. Discuss with your doctor to ensure proper metabolic function.")
        else:
            positive_factors.append(("Insulin", f"Your insulin level of {insulin:.1f} µU/mL is within normal range."))
    
    # Add critical issues first (highest priority)
    for _, msg in critical_issues[:3]:  # Max 3 critical issues
        recommendations.append(msg)
    
    # Add lifestyle recommendations based on context
    exercise = (context.get("exerciseFrequency") or "").lower()
    if exercise in {"none", "light"}:
        recommendations.append("Increase physical activity: Aim for at least 150 minutes of moderate-intensity exercise per week (e.g., brisk walking, cycling) to improve insulin sensitivity and reduce diabetes risk.")
    elif exercise in {"moderate", "active", "very_active", "athlete"}:
        if risk_score < 30:
            positive_factors.append(("Exercise", "Your regular exercise routine is helping maintain your health. Keep it up!"))
        else:
            recommendations.append("Continue your exercise routine—it's an important part of diabetes prevention. Consider adding strength training 2-3 times per week.")
    
    smoking = (context.get("smokingStatus") or "").lower()
    if smoking in {"current", "heavy"}:
        recommendations.append("Quit smoking: Smoking significantly increases diabetes and cardiovascular risk. Seek support from smoking cessation programs or your healthcare provider.")
    elif smoking == "former":
        recommendations.append("Great job quitting smoking! Continue avoiding tobacco to maintain your reduced risk.")
    elif smoking == "never":
        if risk_score < 30:
            positive_factors.append(("Smoking", "Staying smoke-free is protecting your health."))
    
    alcohol = (context.get("alcoholConsumption") or "").lower()
    if alcohol == "heavy":
        recommendations.append("Reduce alcohol consumption: Heavy drinking can affect blood sugar control and weight management. Limit to moderate amounts (1-2 drinks per day for men, 1 for women).")
    elif alcohol in {"none", "light", "occasional"}:
        if risk_score < 30:
            positive_factors.append(("Alcohol", "Your alcohol consumption is within healthy limits."))
    
    # Family history
    if context.get("familyHistoryFlag"):
        recommendations.append("Given your family history of diabetes, maintain regular health screenings and focus on preventive lifestyle measures even when your numbers look good.")
    else:
        if risk_score < 30:
            positive_factors.append(("Family History", "No family history of diabetes is a positive factor."))
    
    # Age-based recommendations
    if age >= 45:
        recommendations.append(f"At age {age:.0f}, your diabetes risk increases. Ensure annual health screenings and maintain healthy lifestyle habits.")
    elif age >= 35:
        recommendations.append("As you approach middle age, focus on maintaining healthy weight, regular exercise, and balanced nutrition to prevent diabetes.")
    
    # Add positive reinforcement (but limit to avoid too many)
    for _, msg in positive_factors[:2]:  # Max 2 positive factors
        if len(recommendations) < 8:
            recommendations.append(msg)
    
    # Risk score-based general recommendations (different for diagnosed vs at-risk)
    if has_diabetes:
        # Management-focused recommendations
        if risk_score >= 75:
            recommendations.insert(0, "Your assessment shows very high risk factors. Work closely with your healthcare team to optimize your diabetes management plan, including medication adjustments and lifestyle modifications.")
        elif risk_score >= 50:
            recommendations.insert(0, "Your assessment indicates elevated risk factors. Focus on improving glucose control through medication adherence, dietary modifications, and regular monitoring.")
        elif risk_score >= 25:
            recommendations.insert(0, "Your assessment shows moderate risk factors. Continue monitoring and maintain good diabetes control through medication, diet, and exercise.")
        else:
            recommendations.insert(0, "Your assessment shows good control. Continue your current management plan and maintain regular follow-ups with your healthcare team.")
        
        # Add diabetes-specific management recommendations
        if hba1c and hba1c >= 7.0:
            recommendations.append("Aim for HbA1c <7% to reduce complication risk. Work with your doctor to adjust your treatment plan if needed.")
        recommendations.append("Monitor your blood glucose regularly and keep a log to share with your healthcare team.")
        recommendations.append("Take medications as prescribed and never skip doses without consulting your doctor.")
        recommendations.append("Schedule regular check-ups: HbA1c every 3-6 months, eye exams annually, and kidney function tests as recommended.")
    else:
        # Prevention-focused recommendations
        if risk_score >= 75:
            recommendations.insert(0, "Your risk score indicates very high risk. Please consult with your healthcare provider immediately for a comprehensive diabetes prevention and management plan.")
        elif risk_score >= 50:
            recommendations.insert(0, "Your risk score indicates elevated risk. Take immediate action: focus on weight management, regular exercise, and blood sugar monitoring.")
        elif risk_score >= 25:
            recommendations.insert(0, "Your risk score shows moderate risk. Implement lifestyle changes now to prevent progression: maintain healthy weight, exercise regularly, and eat a balanced diet.")
    
    # Return top 6-8 most relevant recommendations
    return recommendations[:8]

def build_metric_insights(payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    insights: Dict[str, Dict[str, Any]] = {}

    def insight(status: str, label: str, value_label: str, message: str):
        return {
            "status": status,
            "label": label,
            "valueLabel": value_label,
            "message": message,
        }

    bmi = payload.get("bmi")
    if bmi:
        if 18.5 <= bmi <= 24.9:
            insights["bmi"] = insight("good", "BMI", f"{bmi:.1f}", "Healthy range")
        elif bmi < 18.5:
            insights["bmi"] = insight("warning", "BMI", f"{bmi:.1f}", "Below healthy range")
        else:
            insights["bmi"] = insight("warning", "BMI", f"{bmi:.1f}", "Above healthy range")

    glucose = payload.get("glucose")
    if glucose:
        if glucose < 100:
            insights["glucose"] = insight("good", "Glucose", f"{glucose:.0f} mg/dL", "Normal fasting glucose")
        elif glucose < 126:
            insights["glucose"] = insight("warning", "Glucose", f"{glucose:.0f} mg/dL", "Borderline elevation")
        else:
            insights["glucose"] = insight("critical", "Glucose", f"{glucose:.0f} mg/dL", "Diabetes range")

    systolic = payload.get("systolicBP")
    diastolic = payload.get("diastolicBP")
    if systolic and diastolic:
        bp_value = f"{systolic:.0f}/{diastolic:.0f} mmHg"
        if systolic < 120 and diastolic < 80:
            insights["bloodPressure"] = insight("good", "Blood Pressure", bp_value, "Optimal range")
        elif systolic < 140 and diastolic < 90:
            insights["bloodPressure"] = insight("warning", "Blood Pressure", bp_value, "Elevated")
        else:
            insights["bloodPressure"] = insight("critical", "Blood Pressure", bp_value, "Hypertension range")

    hba1c = payload.get("hba1c")
    if hba1c:
        if hba1c < 5.7:
            insights["hba1c"] = insight("good", "HbA1c", f"{hba1c:.1f}%", "Normal range")
        elif hba1c < 6.5:
            insights["hba1c"] = insight("warning", "HbA1c", f"{hba1c:.1f}%", "Prediabetes range")
        else:
            insights["hba1c"] = insight("critical", "HbA1c", f"{hba1c:.1f}%", "Diabetes range")

    insulin = payload.get("insulin")
    if insulin:
        if 2 <= insulin <= 25:
            insights["insulin"] = insight("good", "Insulin", f"{insulin:.1f} µU/mL", "Within typical fasting range")
        elif insulin < 2:
            insights["insulin"] = insight("warning", "Insulin", f"{insulin:.1f} µU/mL", "Below typical range")
        else:
            insights["insulin"] = insight("warning", "Insulin", f"{insulin:.1f} µU/mL", "Elevated fasting insulin")

    return insights

def load_model():
    """Load the trained model on startup"""
    global predictor
    try:
        # Try improved model first, then fallback to standard
        model_files = [MODEL_FILE]
        if USE_IMPROVED_MODEL:
            model_files.append('diabetes_model.pkl')  # Fallback
        else:
            model_files.insert(0, 'diabetes_model.pkl')
        
        for model_file in model_files:
            if os.path.exists(model_file):
                predictor = DiabetesRiskPredictor()
                predictor.load_model(model_file)
                print(f"✓ Model loaded successfully from {model_file}!")
                return True
        
        print(f"✗ Model file not found. Please train the model first.")
        print(f"  Expected files: {', '.join(model_files)}")
        return False
    except Exception as e:
        print(f"✗ Error loading model: {e}")
        import traceback
        traceback.print_exc()
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint - no rate limit, no API key required"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': predictor is not None,
        'rate_limiting': 'enabled',
        'api_key_required': bool(os.getenv('ML_API_KEY'))
    })

@app.route('/predict', methods=['POST'])
@rate_limit("20 per minute")  # Rate limit: 20 requests per minute
@require_api_key  # Require valid API key
def predict_diabetes_risk():
    """Predict diabetes risk for a patient"""
    try:
        if predictor is None:
            return jsonify({
                'error': 'Model not loaded. Please ensure the model is trained and saved.'
            }), 500
        
        # Get patient data from request
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = [
            'age', 'bmi', 'glucose', 'bloodPressure', 
            'insulin', 'skinThickness', 'pregnancies', 'familyHistory'
        ]
        
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {missing_fields}'
            }), 400
        
        context_flags = {
            'gender': (data.get('gender') or '').lower(),
            'exerciseFrequency': data.get('exerciseFrequency'),
            'smokingStatus': data.get('smokingStatus'),
            'alcoholConsumption': data.get('alcoholConsumption'),
            'familyHistoryFlag': bool(data.get('familyHistoryFlag', False)),
            'diabetesStatus': data.get('diabetesStatus', 'none'),  # Add diabetes status to context
        }

        systolic_bp = parse_float(data.get('systolicBP') or data.get('bloodPressure'))
        diastolic_bp = parse_float(data.get('diastolicBP') or data.get('bloodPressure'))
        hba1c = parse_float(data.get('hba1c'))

        # Prepare patient data for prediction
        patient_data = {
            'pregnancies': parse_float(data.get('pregnancies')),
            'glucose': parse_float(data.get('glucose')),
            'bloodPressure': parse_float(data.get('bloodPressure')),
            'skinThickness': parse_float(data.get('skinThickness')),
            'insulin': parse_float(data.get('insulin')),
            'bmi': parse_float(data.get('bmi')),
            'diabetesPedigreeFunction': parse_float(data.get('familyHistory')),  # Map family history
            'age': parse_float(data.get('age')),
            'systolicBP': systolic_bp,
            'diastolicBP': diastolic_bp,
            'hba1c': hba1c if hba1c > 0 else None,
        }
        
        # Use the predictor's predict_risk method (works for both old and new models)
        if hasattr(predictor, 'predict_risk'):
            # New improved model interface
            prediction_result = predictor.predict_risk(patient_data)
            risk_score = prediction_result['riskScore']
            probabilities = {
                'no_diabetes': prediction_result['probabilities']['no_diabetes'],
                'diabetes': prediction_result['probabilities']['diabetes']
            }
            prediction = prediction_result['prediction']
            feature_importance = prediction_result['featureImportance']
            base_confidence = prediction_result['confidenceScore']
        else:
            # Old model format (dictionary-based)
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
            
            input_data = predictor['imputer'].transform(input_data)
            input_data = predictor['scaler'].transform(input_data)
            
            model = predictor['model']
            prediction = model.predict(input_data)[0]
            proba = model.predict_proba(input_data)[0]
            probabilities = {
                'no_diabetes': round(proba[0] * 100, 2),
                'diabetes': round(proba[1] * 100, 2)
            }
            risk_score = proba[1] * 100
            base_confidence = max(proba) * 100
            
            feature_importance = dict(zip(predictor['feature_names'], model.feature_importances_))
            feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
        
        # Apply contextual adjustments
        adjusted_risk_score, healthy_indicators = apply_contextual_adjustments(risk_score, patient_data, context_flags)
        risk_category = categorize_risk(adjusted_risk_score)
        
        # Calculate confidence score
        confidence_score = base_confidence
        if healthy_indicators >= 4 and adjusted_risk_score < 20:
            confidence_score = max(confidence_score, 96)
        elif healthy_indicators >= 2:
            confidence_score = max(confidence_score, 90)
        confidence_score = clamp(confidence_score, 60, 99.5)

        # Add risk score to payload for recommendations
        patient_data_with_risk = {**patient_data, 'riskScore': adjusted_risk_score}
        recommendations = generate_personalized_recommendations(patient_data_with_risk, context_flags)
        metric_insights = build_metric_insights(patient_data, context_flags)
        
        # Ensure probabilities is a dict (for improved model) or convert from list
        if isinstance(probabilities, dict):
            prob_dict = probabilities
        else:
            prob_dict = {
                'no_diabetes': round(probabilities[0] * 100, 2),
                'diabetes': round(probabilities[1] * 100, 2)
            }
        
        result = {
            'riskScore': round(adjusted_risk_score, 2),
            'riskCategory': risk_category,
            'confidenceScore': round(confidence_score, 2),
            'prediction': int(prediction),
            'probabilities': prob_dict,
            'featureImportance': feature_importance,
            'recommendations': recommendations,
            'metricInsights': metric_insights,
            'model_info': {
                'model_type': 'Improved Ensemble (RF + GB)' if USE_IMPROVED_MODEL else 'Random Forest Classifier',
                'features_used': (
                    predictor.enhanced_feature_names if hasattr(predictor, 'enhanced_feature_names') and predictor.enhanced_feature_names is not None
                    else (predictor['feature_names'] if isinstance(predictor, dict) else (predictor.feature_names if hasattr(predictor, 'feature_names') else []))
                ),
                'version': '2.0' if USE_IMPROVED_MODEL else '1.0'
            }
        }
        
        return jsonify(result)
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"✗ Prediction error: {str(e)}")
        print(f"Error traceback:\n{error_trace}")
        return jsonify({
            'error': f'Prediction failed: {str(e)}',
            'details': error_trace if app.debug else None
        }), 500

@app.route('/model/info', methods=['GET'])
@require_api_key  # Require valid API key
def model_info():
    """Get information about the trained model"""
    try:
        if predictor is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        # Handle both old and new model formats
        if hasattr(predictor, 'get_feature_importance'):
            # New improved model
            feature_importance = predictor.get_feature_importance()
            features = predictor.enhanced_feature_names or predictor.feature_names
            model_type = 'Improved Ensemble (Random Forest + Gradient Boosting)'
        else:
            # Old model format
            model = predictor['model']
            feature_importance = dict(zip(predictor['feature_names'], model.feature_importances_))
            feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
            features = predictor['feature_names']
            model_type = 'Random Forest Classifier'
        
        return jsonify({
            'model_type': model_type,
            'features': features,
            'feature_importance': feature_importance,
            'model_loaded': True,
            'improved_model': USE_IMPROVED_MODEL
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to get model info: {str(e)}'
        }), 500

@app.route('/batch_predict', methods=['POST'])
@rate_limit("5 per minute")  # Rate limit: 5 requests per minute (more restrictive)
@require_api_key  # Require valid API key
def batch_predict():
    """Predict diabetes risk for multiple patients"""
    try:
        if predictor is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        data = request.get_json()
        
        if not data or 'patients' not in data:
            return jsonify({'error': 'No patients data provided'}), 400
        
        patients = data['patients']
        if not isinstance(patients, list):
            return jsonify({'error': 'Patients data must be a list'}), 400
        
        results = []
        model = predictor['model']
        
        for i, patient in enumerate(patients):
            try:
                # Prepare patient data
                patient_data = {
                    'pregnancies': parse_float(patient.get('pregnancies')),
                    'glucose': parse_float(patient.get('glucose')),
                    'bloodPressure': parse_float(patient.get('bloodPressure')),
                    'skinThickness': parse_float(patient.get('skinThickness')),
                    'insulin': parse_float(patient.get('insulin')),
                    'bmi': parse_float(patient.get('bmi')),
                    'diabetesPedigreeFunction': parse_float(patient.get('familyHistory')),
                    'age': parse_float(patient.get('age'))
                }
                
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
                
                # Handle missing values and normalize
                input_data = predictor['imputer'].transform(input_data)
                input_data = predictor['scaler'].transform(input_data)
                
                # Make prediction
                prediction = model.predict(input_data)[0]
                probabilities = model.predict_proba(input_data)[0]
                risk_score = probabilities[1] * 100
                risk_category = categorize_risk(risk_score)
                confidence_score = clamp(max(probabilities) * 100, 60, 99.5)
                
                results.append({
                    'patient_id': i,
                    'riskScore': round(risk_score, 2),
                    'riskCategory': risk_category,
                    'confidenceScore': round(confidence_score, 2),
                    'prediction': int(prediction),
                    'probabilities': {
                        'no_diabetes': round(probabilities[0] * 100, 2),
                        'diabetes': round(probabilities[1] * 100, 2)
                    }
                })
                
            except Exception as e:
                results.append({
                    'patient_id': i,
                    'error': f'Prediction failed: {str(e)}'
                })
        
        return jsonify({
            'predictions': results,
            'total_patients': len(patients),
            'successful_predictions': len([r for r in results if 'error' not in r])
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Batch prediction failed: {str(e)}'
        }), 500

# ==================== Rate Limit Error Handler ====================
@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded errors"""
    return jsonify({
        'error': 'Rate limit exceeded',
        'message': str(e.description),
        'retry_after': e.get_retry_after() if hasattr(e, 'get_retry_after') else None
    }), 429

if __name__ == '__main__':
    print("Starting Diabetes Risk Prediction API...")
    print(f"Environment: {os.getenv('FLASK_ENV', 'development')}")
    print(f"API Key Required: {bool(os.getenv('ML_API_KEY'))}")
    
    # Load model on startup
    if load_model():
        print("✓ API ready to serve predictions!")
        print("Rate Limits:")
        print("  - Global: 1000 requests/hour")
        print("  - /predict: 20 requests/minute")
        print("  - /batch_predict: 5 requests/minute")
        
        # Use debug mode from environment variable
        debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
        port = int(os.environ.get("PORT", 5000))
        app.run(host='0.0.0.0', port=port, debug=debug_mode)
    else:
        print("✗ Failed to load model. API will not start.")
