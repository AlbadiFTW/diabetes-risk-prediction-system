# Enhanced Diabetes Risk Prediction Frontend

## 🚀 Overview

This enhanced React frontend provides a comprehensive diabetes risk prediction system with advanced features for both patients and healthcare providers. The system integrates with a Flask ML API and Convex backend to deliver real-time risk assessments with detailed analytics and visualizations.

## ✨ Key Features

### 🏥 Patient Interface
- **Medical Data Input Form** with comprehensive validation
- **Real-time Risk Assessment** using ML API integration
- **Interactive Results Dashboard** with animated gauges and progress bars
- **Risk Category Visualization** with color-coded indicators
- **Feature Importance Charts** showing key risk factors
- **Personalized Recommendations** based on risk level
- **Assessment History** with trend analysis
- **Assessment Deletion** - Delete incorrect assessments with confirmation
- **Interactive Tutorial** - Step-by-step guide for first-time users
- **Mobile-responsive Design** for accessibility

### 👨‍⚕️ Doctor Interface
- **Patient Management Dashboard** with risk indicators
- **High-risk Patient Alerts** for immediate attention
- **Patient Search and Filtering** capabilities
- **Detailed Patient Views** with complete assessment history
- **Practice Analytics** with risk distribution charts
- **Statistics Dashboard** for practice insights

### 📊 Data Visualization
- **Recharts Integration** for professional charts
- **Risk Score Gauges** with animated progress
- **Feature Importance Bar Charts** 
- **Historical Trend Line Charts**
- **Risk Distribution Pie Charts**
- **Interactive Tooltips** and legends
- **Chart Zoom Functionality** - Click to zoom charts with detailed data tables
- **Enhanced Tooltips** - Structured tooltips with title, description, normal ranges, and diabetes risk information

### 🎨 Design & UX
- **Healthcare Color Scheme** (blues, whites, medical colors)
- **Tailwind CSS** for consistent styling
- **Fully Responsive Design** for all devices (mobile, tablet, desktop)
- **Mobile-First Approach** with touch-optimized interactions
- **Loading States** and error handling
- **Professional Medical UI** (clean, trustworthy)
- **Accessibility Features** for inclusive design
- **Touch-Friendly Targets** - All buttons meet 44x44px minimum size

## 🛠 Technical Stack

### Frontend
- **React 19** with TypeScript
- **Convex** for real-time database
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for icons
- **Radix UI** for accessible components

### Backend Integration
- **Flask ML API** at `http://localhost:5000`
- **Convex Backend** for data persistence
- **CORS Configuration** for cross-origin requests
- **Real-time Updates** with Convex subscriptions

## 📁 File Structure

```
src/
├── components/
│   ├── EnhancedDashboard.tsx          # Main dashboard router
│   ├── EnhancedPatientDashboard.tsx  # Patient interface
│   ├── EnhancedDoctorDashboard.tsx   # Doctor interface
│   ├── EnhancedMedicalRecordForm.tsx # ML-integrated form
│   ├── EnhancedRiskChart.tsx         # Advanced charts
│   ├── InteractiveTutorial.tsx        # Step-by-step tutorial system
│   ├── tutorialSteps.ts              # Tutorial step definitions
│   ├── TermsModal.tsx                # Terms of service modal
│   ├── ProfilePage.tsx               # User profile management
│   └── ... (existing components)
├── App.tsx                           # Updated to use enhanced dashboard
└── ...
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+ with Flask ML API running
- Convex backend configured

### Installation

1. **Install Dependencies**
   ```bash
   npm install recharts lucide-react @radix-ui/react-progress @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-dialog @radix-ui/react-tooltip
   ```

2. **Start the Development Server**
   ```bash
   npm run dev
   ```

3. **Ensure Flask ML API is Running**
   ```bash
   cd ml-model
   python app.py
   ```

### Configuration

#### CORS Setup
The Flask API is configured to accept requests from:
- `http://localhost:3000` (React dev server)
- `http://localhost:5173` (Vite dev server)
- Production domains

#### Environment Variables
Create a `.env.local` file:
```env
VITE_CONVEX_URL=your_convex_url
VITE_ML_API_URL=http://localhost:5000
```

## 📱 User Interfaces

### Patient Dashboard
1. **Overview Tab**
   - Key metrics cards (risk score, assessments, confidence)
   - Recent assessment history
   - Quick action buttons
   - Health trend indicators

2. **New Assessment Tab**
   - Comprehensive medical data form
   - Real-time validation
   - ML API integration
   - Results visualization with recommendations

3. **History Tab**
   - Assessment timeline
   - Risk score trends
   - Filter by date range
   - Detailed assessment views

4. **Analytics Tab**
   - Interactive charts and graphs
   - Feature importance analysis
   - Health metrics trends
   - Risk distribution visualization

### Doctor Dashboard
1. **Overview Tab**
   - Practice statistics
   - Risk distribution charts
   - Recent activity feed
   - High-risk patient alerts

2. **Patients Tab**
   - Patient list with risk indicators
   - Search and filter functionality
   - Patient detail views
   - Assessment history

3. **High Risk Tab**
   - Critical patient alerts
   - Immediate attention required
   - Risk score monitoring
   - Action buttons

4. **Analytics Tab**
   - Practice-wide analytics
   - Risk distribution analysis
   - Patient trend monitoring
   - Performance metrics
   - **Key Risk Factors** with enhanced tooltips
   - **Chart Zoom** - Click charts to view enlarged versions with detailed data
   - **Patient Analytics** - Select patient to view their detailed analytics

## 🔧 API Integration

### ML API Endpoints
- `POST /predict` - Single patient prediction
- `POST /batch_predict` - Multiple patients
- `GET /health` - API health check
- `GET /model/info` - Model information

### Convex Functions
- `api.medicalRecords.createMedicalRecord`
- `api.predictions.generateRiskPrediction`
- `api.dashboard.getPatientDashboardData`
- `api.dashboard.getDoctorDashboardData`

## 🎨 Design System

### Color Palette
- **Primary**: Blue (#3b82f6) - Trust, medical
- **Success**: Green (#10b981) - Low risk
- **Warning**: Yellow (#f59e0b) - Moderate risk
- **Danger**: Red (#ef4444) - High risk
- **Neutral**: Gray (#6b7280) - Secondary text

### Typography
- **Headings**: Inter, system fonts
- **Body**: System font stack
- **Sizes**: Responsive scale (sm, base, lg, xl, 2xl)
- **Mobile Optimization**: Smaller text sizes on mobile (e.g., `text-2xl sm:text-3xl`)

### Components
- **Cards**: Rounded corners, subtle shadows, responsive padding
- **Buttons**: Consistent padding, hover states, 44px minimum touch targets
- **Forms**: Clear labels, validation states, mobile-optimized layouts
- **Charts**: Professional medical styling, responsive containers
- **Modals**: Sticky footers, scrollable content, always-visible buttons, mobile-friendly
- **Tutorial**: Interactive step-by-step guide with element highlighting, mobile responsive
- **Navigation**: Horizontally scrollable on mobile, touch-optimized
- **Banners**: Stack vertically on mobile, responsive text and buttons

## 🎓 Interactive Tutorial System

### Overview
The interactive tutorial system provides a guided onboarding experience for first-time users, explaining dashboard features and navigation.

### Features
- **Step-by-step guidance** with visual element highlighting
- **Progress tracking** with step counter and progress bar
- **Skip option** available at any time
- **One-time display** - shows only once per user
- **Restart capability** from Profile settings
- **Comprehensive coverage** - 12 steps for patients, 9 steps for doctors
- **New features included** - Medications, Messages, Education, History tabs

### Tutorial Steps

**Patient Dashboard (12 steps):**
1. Welcome introduction
2. Risk Score card
3. Health Metrics overview
4. Recent Assessments
5. New Assessment tab
6. History tab
7. Medications tab
8. Analytics tab
9. Education tab
10. Messages tab
11. Profile tab
12. Completion

**Doctor Dashboard (9 steps):**
1. Welcome introduction
2. Overview statistics
3. High-Risk Patients alerts
4. Patients tab
5. High-Risk tab
6. Analytics tab
7. Messages tab
8. Profile tab
9. Completion

### Implementation
- **InteractiveTutorial.tsx**: Main tutorial component with overlay and tooltip
- **tutorialSteps.ts**: Step definitions for patient and doctor dashboards
- **Backend integration**: Tutorial completion status stored in user profile
- **Profile integration**: Restart button in Profile settings
- **Mobile responsive**: Tutorial works seamlessly on mobile devices

## 🗑️ Assessment Deletion Feature

### Overview
Patients can delete their own assessments if they made a mistake during submission. The system uses soft delete to maintain data integrity.

### Features
- **Soft delete** - Data preserved, marked as deleted
- **Confirmation modal** - Prevents accidental deletions
- **Permission-based** - Patients can only delete their own assessments
- **Doctor access** - Doctors can delete assessments for assigned patients
- **Audit logging** - All deletions logged for compliance

## 📊 Data Visualization

### Chart Types
1. **Risk Score Gauge** - Circular progress with color coding
2. **Feature Importance** - Horizontal bar chart
3. **Trend Analysis** - Line charts with multiple metrics
4. **Risk Distribution** - Pie charts for categorization
5. **Health Metrics** - Multi-line charts for vital signs

### Interactive Features
- **Hover Tooltips** with detailed information
- **Click Interactions** for drill-down analysis
- **Responsive Scaling** for different screen sizes
- **Animation Effects** for smooth transitions

## 🔒 Security & Privacy

### Data Protection
- **Input Validation** on all forms
- **CORS Configuration** for secure API calls
- **Error Handling** for API failures
- **Loading States** for user feedback

### Medical Data Handling
- **Secure Transmission** to ML API
- **Data Validation** before processing
- **Error Recovery** for failed predictions
- **User Consent** for data processing

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Environment Configuration
- Update CORS origins for production domain
- Configure Convex production URL
- Set up ML API production endpoint
- Enable HTTPS for secure communication

### Performance Optimization
- **Code Splitting** for faster loading
- **Image Optimization** for medical charts
- **Caching Strategy** for API responses
- **Bundle Analysis** for size optimization

## 🧪 Testing

### Component Testing
```bash
npm run test
```

### API Integration Testing
- Test ML API connectivity
- Verify CORS configuration
- Validate data flow
- Check error handling

### User Experience Testing
- Mobile responsiveness
- Accessibility compliance
- Performance benchmarks
- Cross-browser compatibility

## 📈 Analytics & Monitoring

### User Analytics
- Assessment completion rates
- Feature usage statistics
- Error tracking and reporting
- Performance metrics

### Medical Analytics
- Risk score distributions
- Patient trend analysis
- Doctor practice insights
- Model performance monitoring

## 🔮 Future Enhancements

### Planned Features
- **Real-time Notifications** for high-risk patients
- **Advanced Analytics** with machine learning insights
- **Mobile App** for patient monitoring
- **Integration** with EHR systems
- **Telemedicine** capabilities

### Technical Improvements
- **Offline Support** for critical functions
- **Progressive Web App** features
- **Advanced Caching** strategies
- **Microservices** architecture
- **AI-powered** recommendations

## 📞 Support

### Documentation
- Component documentation in code
- API integration guides
- Deployment instructions
- Troubleshooting guides

### Development
- Code reviews and testing
- Performance monitoring
- Security audits
- User feedback integration

---

## 🎯 Graduation Project Features

This enhanced frontend demonstrates:

✅ **Advanced React Development** with TypeScript
✅ **Real-time Data Integration** with Convex
✅ **ML API Integration** with Flask backend
✅ **Professional Medical UI/UX** design
✅ **Comprehensive Data Visualization** with Recharts
✅ **Responsive Design** for all devices
✅ **Production-ready Code** with error handling
✅ **Healthcare Industry Standards** compliance

Perfect for showcasing modern web development skills in a medical technology context!
