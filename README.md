# Diabetes Risk Prediction System
  
This is a project built with [Chef](https://chef.convex.dev) using [Convex](https://convex.dev) as its backend.
 You can find docs about Chef with useful information like how to deploy to production [here](https://docs.convex.dev/chef).
  
This project is connected to the Convex deployment named [`brainy-flamingo-145`](https://dashboard.convex.dev/d/brainy-flamingo-145).
  
## Project structure
  
The frontend code is in the `app` directory and is built with [Vite](https://vitejs.dev/).
  
The backend code is in the `convex` directory.
  
`npm run dev` will start the frontend and backend servers.

## App authentication

Chef apps use [Convex Auth](https://auth.convex.dev/) with Anonymous auth for easy sign in. You may wish to change this before deploying your app.

## Developing and deploying your app

Check out the [Convex docs](https://docs.convex.dev/) for more information on how to develop with Convex.
* If you're new to Convex, the [Overview](https://docs.convex.dev/understanding/) is a good place to start
* Check out the [Hosting and Deployment](https://docs.convex.dev/production/) docs for how to deploy your app
* Read the [Best Practices](https://docs.convex.dev/understanding/best-practices/) guide for tips on how to improve you app further

## HTTP API

User-defined http routes are defined in the `convex/router.ts` file. We split these routes into a separate file from `convex/http.ts` to allow us to prevent the LLM from modifying the authentication routes.

## Documentation

For detailed information about bugs fixed, system architecture, and testing procedures, please refer to:

- **CHANGELOG.md** - Complete changelog of all features, enhancements, and bug fixes

- **BUGS_FIXED.md** - Comprehensive list of all bugs found and fixed, including:
  - ML model accuracy fixes
  - Data format standardization
  - UI/UX enhancements
  - Analytics improvements
  - TypeScript error corrections
  - Doctor assignment fixes
  - Risk category threshold updates

- **SYSTEM_ARCHITECTURE.md** - System architecture and design documentation

- **TESTING_CHECKLIST.md** - Testing procedures and checklists

- **ENHANCED_FRONTEND_README.md** - Frontend component documentation

## Recent Updates

### Phase 6 - Comprehensive Feature Additions (2025)
- ✅ **Patient Education Resources** - Articles, videos, tips, and guides for diabetes prevention
- ✅ **Advanced Analytics** - Comparative analysis, cohort studies, and predictive trends
- ✅ **Medication Management** - Medication tracking, dosage reminders, and drug interaction warnings
- ✅ **Assessment Reminders** - Automated reminders for follow-up health assessments
- ✅ **Messaging System** - Real-time communication between patients and doctors
- ✅ **Support System** - Support ticket system for user assistance
- ✅ **Password Reset** - Secure password reset with email verification
- ✅ **Print & Export** - Print assessments and export data to PDF/CSV
- ✅ **Error Boundaries** - Graceful error handling with fallback UI
- ✅ **Email Notifications** - Comprehensive email notification system
- ✅ **Doctor Reports** - PDF report generation for patient health summaries
- ✅ **Notification System** - In-app notification center with badge counts
- ✅ **Audit Log Viewer** - Admin interface for tracking user actions

### Phase 5 - Security Enhancements (2025)
- ✅ **Two-Factor Authentication (2FA)** - Enhanced account security with TOTP and SMS support
  - Authenticator app integration (Google Authenticator, Authy, etc.)
  - SMS-based verification codes
  - Backup codes for account recovery
  - Session-based verification management
  - Profile integration for easy management

### Phase 4 - Latest Features (2025)
- ✅ **Interactive Tutorial System** - Step-by-step guide for first-time users
- ✅ **Assessment Deletion** - Patients can delete incorrect assessments (soft delete)
- ✅ **Modal Fixes** - All modal buttons now visible and clickable
- ✅ **Tutorial Logic** - Shows only once per user (can restart from Profile)
- ✅ **Schema Updates** - Backward compatibility for existing records

### Phase 3 - UI/UX Enhancements (2025)
- ✅ Fixed Analytics tab showing wrong data (now shows latest assessment)
- ✅ Fixed Key Risk Factors chart with health status indicators
- ✅ Fixed metric charts to show different values for each assessment
- ✅ Expanded lifestyle options (8 smoking, 6 alcohol, 6 exercise choices)
- ✅ Implemented doctor assignment modal with search functionality
- ✅ Fixed doctor assignment table mismatch (users vs userProfiles IDs)
- ✅ Updated risk category thresholds to medical standards
- ✅ Resolved all TypeScript errors across components
- ✅ Enhanced form visual hierarchy with accent bars

See **BUGS_FIXED.md** for complete details on all fixes and enhancements.
