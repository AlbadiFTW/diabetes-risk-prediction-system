# Diabetes Risk Prediction System - System Architecture

## Project Overview

The Diabetes Risk Prediction System is a comprehensive healthcare application designed to assess and monitor diabetes risk in patients using machine learning algorithms. The system aligns with Oman Vision 2040's healthcare digitization goals and supports sustainable healthcare practices through early detection and prevention.

### Key Features and Capabilities

- **Patient Risk Assessment**: ML-powered diabetes risk prediction using comprehensive health metrics
- **Doctor-Patient Management**: Secure assignment and monitoring system for healthcare providers
- **Real-time Analytics**: Interactive dashboards with trend analysis and risk visualization
- **Comprehensive Health Tracking**: Multi-metric health data collection and analysis
- **Role-based Access Control**: Secure patient and doctor portals with appropriate permissions
- **Audit Trail**: Complete logging of all system activities for compliance

## Technical Architecture

### Frontend Architecture (React + TypeScript)

The frontend is built with React 18, TypeScript, and modern UI components:

#### Core Components:
- **EnhancedPatientDashboard.tsx**: Patient portal with risk assessment, history, and analytics
- **EnhancedDoctorDashboard.tsx**: Doctor portal for patient management and monitoring
- **EnhancedMedicalRecordForm.tsx**: Comprehensive health data input form
- **EnhancedRiskChart.tsx**: Interactive data visualization with multiple chart types

#### Key Features:
- Real-time data updates using Convex reactive queries
- Responsive design with Tailwind CSS
- Interactive charts using Recharts library
- Form validation and error handling
- Role-based UI rendering

### Backend Architecture (Convex)

The backend uses Convex as a real-time database with built-in authentication and API functions:

#### Database Schema:
```typescript
// Core Tables
- userProfiles: User roles and profile information
- medicalRecords: Patient health data and assessments
- riskPredictions: ML model predictions and results
- testResults: Laboratory test results
- patientDocuments: File storage and document management
- notifications: System alerts and communications
- auditLogs: Security and compliance logging
```

#### Key Functions:
- **Queries**: Real-time data fetching with automatic updates
- **Mutations**: Secure data modification with validation
- **Actions**: External API calls and complex operations
- **Authentication**: Role-based access control

### ML Model Architecture (Flask API)

The machine learning component uses a Random Forest Classifier trained on diabetes prediction data:

#### Model Features:
- **Input Features**: Age, BMI, Glucose, Blood Pressure, Insulin, Skin Thickness, Pregnancies, Family History
- **Output**: Risk score (0-100%), Risk category, Confidence score, Feature importance
- **Preprocessing**: Data imputation and normalization
- **API Endpoints**: `/predict`, `/batch_predict`, `/health`, `/model/info`

## Component Breakdown

### Frontend Components

#### EnhancedPatientDashboard.tsx
- **Purpose**: Main patient interface for risk monitoring
- **Features**: 
  - Risk score visualization with gauge charts
  - Assessment history with filtering
  - Health trend analytics
  - Quick action buttons
- **Data Sources**: `getPatientDashboardData`, `getRiskPredictionsByPatient`

#### EnhancedDoctorDashboard.tsx
- **Purpose**: Doctor interface for patient management
- **Features**:
  - Patient list with risk filtering
  - High-risk patient alerts
  - Practice analytics
  - Patient assignment management
- **Data Sources**: `getDoctorDashboardData`, `getAssignedPatients`, `getHighRiskPatients`

#### EnhancedMedicalRecordForm.tsx
- **Purpose**: Comprehensive health data collection
- **Features**:
  - Multi-section form with validation
  - Real-time BMI calculation
  - ML API integration
  - Results visualization
- **Integration**: Calls ML API and stores results in Convex

#### EnhancedRiskChart.tsx
- **Purpose**: Data visualization and analytics
- **Features**:
  - Risk score trend line charts
  - Feature importance bar charts
  - Health metrics tracking
  - Risk distribution pie charts
- **Libraries**: Recharts for interactive visualizations

### Backend Functions (Convex)

#### Medical Records (medicalRecords.ts)
- **createMedicalRecord**: Store new patient assessments
- **getMedicalRecordsByPatient**: Retrieve patient history
- **updateMedicalRecord**: Modify existing records
- **deleteMedicalRecord**: Soft delete with audit trail

#### Predictions (predictions.ts)
- **generateRiskPrediction**: ML model integration
- **getRiskPredictionsByPatient**: Patient prediction history
- **getHighRiskPatients**: Doctor alert system
- **validatePrediction**: Doctor validation workflow

#### Users (users.ts)
- **createUserProfile**: User registration and role assignment
- **getAssignedPatients**: Doctor-patient relationships
- **assignPatientToDoctor**: Patient assignment workflow
- **getAllDoctors**: Doctor selection for patients

#### Dashboard (dashboard.ts)
- **getPatientDashboardData**: Patient analytics and trends
- **getDoctorDashboardData**: Doctor practice metrics
- **getHighRiskPatients**: Risk monitoring system
- **getUserNotifications**: Alert and notification system

## Database Schema

### Core Relationships

```
Users (Authentication)
├── userProfiles (Role-based profiles)
│   ├── assignedDoctorId (Doctor-Patient link)
│   └── role (patient/doctor)
│
Medical Records
├── patientId → Users
├── recordedBy → Users (Doctor)
└── recordType (baseline/followup/emergency)
│
Risk Predictions
├── patientId → Users
├── medicalRecordId → Medical Records
├── predictedBy → Users (Doctor)
└── riskScore, confidenceScore, riskCategory
│
Test Results
├── patientId → Users
├── orderedBy → Users (Doctor)
└── testType, result, status
│
Notifications
├── recipientId → Users
└── type, priority, isRead
```

### Data Flow

1. **Patient Registration**: User creates profile with role assignment
2. **Health Assessment**: Patient fills medical record form
3. **ML Prediction**: Form data sent to Flask API for risk calculation
4. **Data Storage**: Results stored in Convex with audit logging
5. **Real-time Updates**: Frontend automatically updates with new data
6. **Doctor Monitoring**: Doctors see assigned patients and risk alerts
7. **Analytics**: Trend analysis and feature importance visualization

## ML Model Details

### Algorithm: Random Forest Classifier
- **Features**: 8 health metrics (age, BMI, glucose, blood pressure, etc.)
- **Preprocessing**: Imputation for missing values, normalization
- **Output**: Binary classification with probability scores
- **Confidence**: Based on maximum probability from model
- **Feature Importance**: Tree-based importance ranking

### API Integration
- **Endpoint**: `http://localhost:5000/predict`
- **Input**: JSON with health metrics
- **Output**: Risk score, category, confidence, feature importance
- **Error Handling**: Graceful fallback for API failures

## Security and Compliance

### Authentication
- Convex Auth with role-based access control
- Patient data isolation (patients see only their data)
- Doctor access limited to assigned patients
- Audit logging for all data access

### Data Privacy
- Soft delete for data retention
- Encrypted data transmission
- Role-based permissions
- Compliance logging

### Error Handling
- Form validation with user feedback
- API error recovery
- Graceful degradation
- User-friendly error messages

## Performance Considerations

### Real-time Updates
- Convex reactive queries for automatic UI updates
- Optimized database indexes
- Efficient data fetching patterns

### Scalability
- Modular component architecture
- Efficient ML API caching
- Database query optimization
- Responsive design for all devices

## Future Enhancements

### Planned Features
- Mobile app development
- Advanced analytics and reporting
- Integration with hospital systems
- Multi-language support
- Advanced ML model versions

### Technical Improvements
- Enhanced security measures
- Performance optimization
- Advanced visualization options
- API rate limiting
- Caching strategies

This architecture provides a robust, scalable foundation for diabetes risk prediction while maintaining security, usability, and compliance with healthcare standards.
