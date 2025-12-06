# Implementation Documentation
## Diabetes Risk Prediction System

This document provides comprehensive documentation of all features, implementations, and changes made to the Diabetes Risk Prediction System.

---

## Table of Contents

1. [Email Verification System](#email-verification-system)
2. [Profile Setup Flow](#profile-setup-flow)
3. [Account Management](#account-management)
4. [Admin Dashboard](#admin-dashboard)
5. [File Structure](#file-structure)
6. [Database Schema Changes](#database-schema-changes)
7. [API Reference](#api-reference)

---

## Email Verification System

### Overview
Implemented a 6-digit code email verification system using Resend for email delivery. Users can log in without verification but will see a reminder banner and cannot perform health assessments until verified.

### Technology Stack
- **Email Service**: Resend (free tier: 3,000 emails/month)
- **Backend**: Convex Actions for email sending
- **Frontend**: React components with modal UI

### Implementation Details

#### 1. Database Schema Updates

**File**: `convex/schema.ts`

Added fields to `userProfiles` table:
```typescript
isEmailVerified: v.optional(v.boolean()),
emailVerifiedAt: v.optional(v.number()),
```

Created new `verificationCodes` table:
```typescript
verificationCodes: defineTable({
  email: v.string(),
  code: v.string(),
  type: v.union(v.literal("email_verification"), v.literal("password_reset")),
  expiresAt: v.number(),
  used: v.boolean(),
  attempts: v.number(),
  createdAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_code", ["code"]),
```

#### 2. Backend Functions

**File**: `convex/emailVerification.ts`

**Functions Created**:
- `isEmailVerified` (query): Checks if user's email is verified
- `createVerificationCode` (mutation): Generates and stores a 6-digit code (15-minute expiration)
- `verifyCode` (mutation): Validates code, updates user profile on success (max 5 attempts)
- `canResendCode` (query): Checks if user can resend (1-minute cooldown)

**Key Features**:
- 6-digit random code generation
- 15-minute expiration
- Maximum 5 verification attempts
- Automatic cleanup of expired/unused codes
- 1-minute cooldown between resend requests

#### 3. Email Sending Action

**File**: `convex/emails.ts`

**Function**: `sendVerificationEmail` (action)

**Features**:
- Uses Resend API for email delivery
- HTML-formatted email template
- Creates verification code before sending
- Error handling and validation

**Environment Setup**:
```bash
npx convex env set RESEND_API_KEY "re_your_api_key_here"
```

#### 4. Frontend Components

**File**: `src/components/EmailVerificationBanner.tsx`

**Features**:
- Displays at top of dashboard for unverified users
- "Verify Now" button opens verification modal
- Dismissible (hides until page refresh)
- Auto-hides when user is verified

**File**: `src/components/EmailVerificationModal.tsx`

**Features**:
- 6-digit code input with auto-focus
- Paste support for full code
- Auto-submit when all digits entered
- Resend functionality with countdown timer
- Success/error states
- Loading indicators

**File**: `src/hooks/useEmailVerification.ts`

**Purpose**: Custom hook for checking verification status across components

**Usage**:
```typescript
const { isVerified, email, isLoading } = useEmailVerification();
```

#### 5. Doctor Email Verification Requirements

**Overview**: Doctors must verify their email address before accessing patient data or assigning patients. This ensures only verified medical professionals can access sensitive patient information.

**Implementation**:

**File**: `src/components/EnhancedDoctorDashboard.tsx`

**Key Changes**:
- Added `EmailVerificationBanner` component import and display
- Email verification status check using `api.emailVerification.isEmailVerified`
- Conditional query execution - queries skipped when email not verified
- UI restrictions when email not verified:
  - Dashboard metrics show "—" instead of data
  - Patient list hidden with informative message
  - "Add Patient" button disabled with tooltip
  - High-risk patients section shows verification required message

**File**: `convex/dashboard.ts`

**Function**: `getDoctorDashboardData`

**Changes**:
- Added email verification check after role verification
- Returns empty data structure instead of throwing error when email not verified:
  ```typescript
  if (!(userProfile as any).isEmailVerified) {
    return {
      totalPatients: 0,
      highRiskPatientsCount: 0,
      recentAssessmentsCount: 0,
      riskDistribution: { low: 0, moderate: 0, high: 0, very_high: 0 },
      latestPredictions: [],
      recentRecords: [],
    };
  }
  ```

**File**: `convex/users.ts`

**Function**: `getAssignedPatients`

**Changes**:
- Added email verification check after role verification
- Returns empty array instead of throwing error when email not verified

**Function**: `assignPatientToDoctor`

**Changes**:
- Added email verification check
- Throws error if doctor email not verified (prevents assignment attempts)

**User Experience**:
- Verification banner appears at top of dashboard
- Clear error messages when attempting restricted actions
- Graceful degradation (empty data instead of errors)
- All patient-related features disabled until verification complete

---

## Profile Settings Improvements

### Removed Redundant "Share Data with Doctor" Toggle

**Overview**: Removed the "Share Data with Doctor" toggle from patient profile settings as it was redundant. Doctors can only see patient data when explicitly assigned, making the toggle unnecessary.

**Reason for Removal**:
- Doctors can only access patient data when assigned (`assignedDoctorId` check)
- Assignment mechanism already provides explicit patient consent
- The `shareWithDoctor` field existed in schema but was never checked in access control logic
- Assignment is the single source of truth for doctor-patient data access

**Files Modified**:
- `src/components/ProfilePage.tsx`:
  - Removed `shareWithDoctor` state variable
  - Removed toggle UI component
  - Removed `updateAccountSettings` mutation call for `shareWithDoctor`
  - Removed `useEffect` that synced `shareWithDoctor` from profile

**Technical Notes**:
- The `shareWithDoctor` field remains in schema for backward compatibility
- No database migration needed (field was optional and unused)
- Access control logic in `canAccessPatientData` functions only checks `assignedDoctorId`

**Access Control Logic**:
```typescript
// In convex/medicalRecords.ts, convex/medications.ts, etc.
if (userProfile.role === "doctor") {
  const patientProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", patientId))
    .unique();
  
  // Only checks assignment, not shareWithDoctor
  return patientProfile?.assignedDoctorId === userId;
}
```

#### 5. Access Restrictions

**File**: `src/components/EnhancedMedicalRecordForm.tsx`

**Implementation**:
- Checks verification status before allowing form submission
- Shows blurred form with overlay for unverified users
- Displays clear call-to-action to verify email
- Opens verification modal on button click

#### 6. Integration Points

**File**: `src/components/EnhancedDashboard.tsx`
- Added `<EmailVerificationBanner />` at top of layout

**File**: `src/App.tsx`
- Banner automatically shows for unverified users

---

## Profile Setup Flow

### Overview
Fixed the registration flow to ensure new users complete their profile before accessing the dashboard.

### Problem Solved
Previously, new users were taken directly to the dashboard instead of the profile setup screen.

### Implementation Details

#### 1. Profile Completion Query

**File**: `convex/users.ts`

**Function**: `hasCompletedProfile` (query)

**Checks**:
- User is authenticated
- Profile exists
- Required fields are filled: `firstName`, `lastName`, `role`, `isActive`

**Returns**:
```typescript
{
  hasProfile: boolean,
  isAuthenticated: boolean,
  profile: UserProfile | null
}
```

#### 2. App Routing Logic

**File**: `src/App.tsx`

**Flow**:
```
Sign Up → Authenticated → Check Profile Exists?
                              ↓ No
                         Profile Setup Screen
                              ↓ Complete
                         Dashboard (based on role)
```

**Implementation**:
- `AuthenticatedApp` component checks `hasCompletedProfile`
- Shows loading state while checking
- Routes to `ProfileSetup` if profile incomplete
- Routes to appropriate dashboard if complete

#### 3. Profile Setup Component

**File**: `src/components/ProfileSetup.tsx`

**Features**:
- Collects required fields: name, date of birth, gender, role, phone
- Role selection (Patient/Doctor)
- Doctor-specific fields: specialty, license number, clinic name
- Form validation
- Calls `createUserProfile` mutation
- Handles cancellation with account cleanup

#### 4. Account Cancellation

**File**: `convex/users.ts`

**Function**: `cancelAccountCreation` (mutation)

**Purpose**: Cleans up partially created accounts when user cancels during profile setup

**Actions**:
- Deletes verification codes
- Deletes auth accounts
- Deletes user from `users` table

**Integration**: Called from `ProfileSetup.tsx` when user clicks cancel

---

## Account Management

### Overview
Implemented proper account deletion with hard delete functionality and email confirmation.

### Implementation Details

#### 1. Account Deletion Mutation

**File**: `convex/users.ts`

**Function**: `deleteAccount` (mutation)

**Features**:
- Email confirmation required (case-insensitive, trimmed)
- Hard delete (permanently removes all data)
- Comprehensive data cleanup

**Data Deleted**:
1. User profile
2. Risk predictions
3. Medical records
4. Test results
5. Patient documents (with file storage cleanup)
6. Medications
7. Patient assignments
8. Notifications
9. Verification codes
10. Audit logs
11. Profile images
12. Auth accounts
13. Auth user record

**Safety Features**:
- Email confirmation to prevent accidental deletion
- Trimming and case-insensitive comparison
- Clear error messages

#### 2. Frontend Implementation

**File**: `src/components/ProfilePage.tsx`

**Features**:
- Delete account section in Profile tab
- Confirmation modal with email input
- Client-side validation
- Disabled button until email matches
- Loading states
- Success/error handling

**UI Elements**:
- Danger zone section with warning
- Email confirmation input
- Clear error messages
- Delete confirmation modal

---

## Admin Dashboard

### Overview
Complete admin dashboard for managing users, viewing statistics, and monitoring platform health. Admin is a third role alongside "patient" and "doctor".

### Implementation Details

#### 1. Schema Updates

**File**: `convex/schema.ts`

**Changes**:
- Added `"admin"` to role union in `userProfiles`
- Added account management fields:
  ```typescript
  isActive: v.boolean(),
  deactivatedAt: v.optional(v.number()),
  deactivatedBy: v.optional(v.id("userProfiles")),
  ```

#### 2. Admin Backend Functions

**File**: `convex/admin.ts`

##### Statistics Queries

**`getDashboardStats`** (query):
- Total users (patients, doctors, admins)
- Active users count
- Verified users and verification rate
- Total assessments
- High risk patients count
- Risk distribution (low, moderate, high, very high)
- Recent registrations (30 days)
- Recent assessments (7 days)

**`getRegistrationTrend`** (query):
- User registrations over time (default 30 days)
- Grouped by day
- Returns array of `{ date: string, count: number }`

**`getAssessmentTrend`** (query):
- Health assessments over time (default 30 days)
- Grouped by day
- Returns array of `{ date: string, count: number }`

##### User Management

**`getAllUsers`** (query):
- Lists all users with filtering options
- Search by name or email
- Filter by role (patient/doctor/admin/all)
- Filter by status (active/inactive/all)
- Includes assessment counts and latest risk scores

**`getUserDetails`** (query):
- Detailed user information
- For patients: predictions, medical records, assigned doctor
- For doctors: assigned patients list
- Full profile data

**`toggleUserStatus`** (mutation):
- Activate/deactivate user accounts
- Prevents deactivating yourself
- Prevents deactivating other admins
- Tracks deactivation timestamp and admin

**`verifyUserEmail`** (mutation):
- Manually verify user emails
- Sets `isEmailVerified: true` and `emailVerifiedAt`

**`deleteUserByAdmin`** (mutation):
- Delete user accounts (admin only)
- Prevents deleting yourself
- Prevents deleting other admins
- Comprehensive data cleanup (same as user self-deletion)

##### Doctor-Patient Overview

**`getDoctorPatientOverview`** (query):
- Lists all doctors with patient counts
- Shows unassigned patients
- Returns doctor details and assignment statistics

##### Admin Creation

**`createInitialAdmin`** (mutation):
- One-time use function for creating first admin
- Checks if admin already exists
- Updates existing user profile or creates new one

#### 3. Admin Dashboard UI

**File**: `src/components/AdminDashboard.tsx`

##### Overview Tab
- **Stats Cards**:
  - Total Users (with breakdown)
  - Total Assessments
  - High Risk Patients
  - Verification Rate
- **Charts**:
  - Risk Distribution (Pie Chart)
  - New Registrations (Area Chart - 14 days)
- **Quick Stats**:
  - New Registrations (30 days)
  - Active Users
  - Verified Emails

##### Users Tab
- **Filters**:
  - Search by name/email
  - Filter by role
  - Filter by status
- **Users Table**:
  - User info with avatar
  - Role badge
  - Status badge
  - Email verification status
  - Assessment count
  - Action buttons (view, activate/deactivate, verify email, delete)
- **User Details Modal**:
  - Full user information
  - Assessment history (for patients)
  - Assigned patients (for doctors)
  - Action buttons

##### Analytics Tab
- **Charts**:
  - User Registrations Trend (Area Chart)
  - Health Assessments Trend (Area Chart)
  - Patient Risk Distribution (Bar Chart)

##### Assignments Tab
- **Unassigned Patients Alert**: Shows count of patients without doctors
- **Doctors Grid**: Cards showing each doctor with patient count
- **Unassigned Patients List**: Table of patients without assigned doctors

#### 4. Routing and Access Control

**File**: `src/App.tsx`

**Changes**:
- Routes admins to `AdminDashboard` component
- Blocks deactivated users with clear message
- Shows "Account Deactivated" screen for inactive users

**Deactivated User Screen**:
- Clear message explaining account status
- Sign out button
- Prevents access to dashboard

#### 5. Creating Admin Accounts

**Method 1: Using Convex Dashboard**
1. Sign up a user account normally
2. Go to Convex Dashboard → Data → userProfiles
3. Find the user's profile
4. Edit and change `role` to `"admin"`

**Method 2: Using Setup Mutation**
1. Sign up a user account
2. Go to Convex Dashboard → Functions → Run a function
3. Run `admin.createInitialAdmin` with:
   ```json
   {
     "email": "admin@yourdomain.com",
     "firstName": "Admin",
     "lastName": "User"
   }
   ```

---

## File Structure

### New Files Created

#### Backend
- `convex/emailVerification.ts` - Email verification logic
- `convex/emails.ts` - Resend email sending action
- `convex/admin.ts` - Admin dashboard backend functions

#### Frontend Components
- `src/components/EmailVerificationBanner.tsx` - Verification reminder banner
- `src/components/EmailVerificationModal.tsx` - 6-digit code entry modal
- `src/components/AdminDashboard.tsx` - Complete admin interface

#### Hooks
- `src/hooks/useEmailVerification.ts` - Verification status hook

### Modified Files

#### Backend
- `convex/schema.ts` - Added verification fields, codes table, admin role, account management fields
- `convex/users.ts` - Added `hasCompletedProfile`, `cancelAccountCreation`, updated `deleteAccount`

#### Frontend
- `src/App.tsx` - Added routing for admins and deactivated users
- `src/components/ProfileSetup.tsx` - Added cancellation handler
- `src/components/ProfilePage.tsx` - Updated delete account UI
- `src/components/EnhancedDashboard.tsx` - Added verification banner
- `src/components/EnhancedMedicalRecordForm.tsx` - Added verification check

---

## Database Schema Changes

### userProfiles Table

**New Fields**:
```typescript
// Email verification
isEmailVerified: v.optional(v.boolean()),
emailVerifiedAt: v.optional(v.number()),

// Account management
isActive: v.boolean(),
deactivatedAt: v.optional(v.number()),
deactivatedBy: v.optional(v.id("userProfiles")),
```

**Role Union Updated**:
```typescript
role: v.union(
  v.literal("patient"), 
  v.literal("doctor"), 
  v.literal("admin")  // NEW
)
```

### verificationCodes Table (NEW)

```typescript
verificationCodes: defineTable({
  email: v.string(),
  code: v.string(),
  type: v.union(
    v.literal("email_verification"), 
    v.literal("password_reset")
  ),
  expiresAt: v.number(),
  used: v.boolean(),
  attempts: v.number(),
  createdAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_code", ["code"]),
```

---

## API Reference

### Email Verification API

#### `emailVerification.isEmailVerified`
**Type**: Query  
**Args**: None  
**Returns**: `{ verified: boolean, email: string | null, verifiedAt?: number }`

#### `emailVerification.createVerificationCode`
**Type**: Mutation  
**Args**: `{ email: string }`  
**Returns**: `{ code: string, expiresAt: number }`

#### `emailVerification.verifyCode`
**Type**: Mutation  
**Args**: `{ email: string, code: string }`  
**Returns**: `{ success: boolean, error?: string }`

#### `emailVerification.canResendCode`
**Type**: Query  
**Args**: `{ email: string }`  
**Returns**: `{ canResend: boolean, waitSeconds: number }`

#### `emails.sendVerificationEmail`
**Type**: Action  
**Args**: `{ email: string }`  
**Returns**: `{ success: boolean, messageId?: string, error?: string }`

### User Management API

#### `users.hasCompletedProfile`
**Type**: Query  
**Args**: None  
**Returns**: `{ hasProfile: boolean, isAuthenticated: boolean, profile: UserProfile | null }`

#### `users.cancelAccountCreation`
**Type**: Mutation  
**Args**: None  
**Returns**: `{ success: boolean, message: string }`

#### `users.deleteAccount`
**Type**: Mutation  
**Args**: `{ confirmEmail: string }`  
**Returns**: `{ success: boolean, message: string }`

### Admin API

#### `admin.getDashboardStats`
**Type**: Query  
**Args**: None  
**Returns**: Dashboard statistics object

#### `admin.getAllUsers`
**Type**: Query  
**Args**: `{ role?: "patient" | "doctor" | "admin" | "all", search?: string, status?: "active" | "inactive" | "all" }`  
**Returns**: Array of user objects with stats

#### `admin.getUserDetails`
**Type**: Query  
**Args**: `{ userId: Id<"userProfiles"> }`  
**Returns**: Detailed user object

#### `admin.toggleUserStatus`
**Type**: Mutation  
**Args**: `{ userId: Id<"userProfiles">, isActive: boolean }`  
**Returns**: `{ success: boolean }`

#### `admin.verifyUserEmail`
**Type**: Mutation  
**Args**: `{ userId: Id<"userProfiles"> }`  
**Returns**: `{ success: boolean }`

#### `admin.deleteUserByAdmin`
**Type**: Mutation  
**Args**: `{ userId: Id<"userProfiles"> }`  
**Returns**: `{ success: boolean }`

#### `admin.getRegistrationTrend`
**Type**: Query  
**Args**: `{ days?: number }`  
**Returns**: Array of `{ date: string, count: number }`

#### `admin.getAssessmentTrend`
**Type**: Query  
**Args**: `{ days?: number }`  
**Returns**: Array of `{ date: string, count: number }`

#### `admin.getDoctorPatientOverview`
**Type**: Query  
**Args**: None  
**Returns**: `{ doctors: Array, unassignedPatients: Array, unassignedCount: number }`

#### `admin.createInitialAdmin`
**Type**: Mutation  
**Args**: `{ email: string, firstName: string, lastName: string }`  
**Returns**: `Id<"userProfiles">`

---

## Environment Variables

### Required
```bash
# Resend API Key for email verification
RESEND_API_KEY=re_your_api_key_here
```

**Setup Command**:
```bash
npx convex env set RESEND_API_KEY "re_your_api_key_here"
```

---

## Testing Checklist

### Email Verification
- [ ] Register new user → Verification email sent
- [ ] Banner appears after login for unverified users
- [ ] Click "Verify Now" → Modal opens
- [ ] Enter correct code → Success, banner disappears
- [ ] Enter wrong code → Error message, attempts tracked
- [ ] Resend code → 60 second cooldown works
- [ ] Code expires after 15 minutes
- [ ] Unverified user cannot access assessments
- [ ] Verified user has full access
- [ ] Dismissing banner hides it (until page refresh)

### Profile Setup
- [ ] New user sees profile setup screen
- [ ] Cannot access dashboard without completing profile
- [ ] Profile setup form validates required fields
- [ ] Cancelling profile setup deletes auth account
- [ ] Completing profile setup routes to dashboard

### Account Deletion
- [ ] Delete account requires email confirmation
- [ ] Email comparison is case-insensitive
- [ ] All user data is permanently deleted
- [ ] Auth account is deleted
- [ ] User cannot log in after deletion

### Admin Dashboard
- [ ] Admin account can be created
- [ ] Admin sees admin dashboard (not patient/doctor)
- [ ] Overview shows correct stats
- [ ] Users tab shows all users with search/filter
- [ ] Can view user details in modal
- [ ] Can activate/deactivate users
- [ ] Can manually verify email
- [ ] Can delete users (with confirmation)
- [ ] Analytics charts render correctly
- [ ] Assignments tab shows doctors and patient counts
- [ ] Deactivated users see "Account Deactivated" screen
- [ ] Admin cannot deactivate/delete themselves or other admins

---

## Security Considerations

### Email Verification
- Codes expire after 15 minutes
- Maximum 5 verification attempts
- 1-minute cooldown between resend requests
- Codes are single-use (marked as used after verification)

### Account Management
- Email confirmation required for deletion
- Hard delete removes all associated data
- Deactivated users cannot access the system
- Admin actions are logged (via audit logs)

### Admin Access
- Admin role required for all admin functions
- Cannot deactivate/delete own account
- Cannot deactivate/delete other admins
- All admin actions require authentication

---

## Future Enhancements

### Email Verification
- [ ] Custom email domain support
- [ ] Email templates customization
- [ ] Resend verification email from profile
- [ ] Change email address functionality

### Admin Dashboard
- [ ] Export user data to CSV/PDF
- [ ] Bulk user operations
- [ ] Advanced analytics and reporting
- [ ] System health monitoring
- [ ] Audit log viewer
- [ ] Email notification settings

### Account Management
- [ ] Account suspension (temporary deactivation)
- [ ] Account recovery process
- [ ] Data export before deletion
- [ ] Account merge functionality

---

## Troubleshooting

### Email Not Sending
1. Check Resend API key is set: `npx convex env list`
2. Verify API key is valid in Resend dashboard
3. Check Convex logs for errors
4. Ensure email address is valid format

### Verification Code Not Working
1. Check code hasn't expired (15 minutes)
2. Verify code hasn't exceeded 5 attempts
3. Check if code was already used
4. Try requesting a new code

### Admin Dashboard Not Showing
1. Verify user role is set to "admin" in database
2. Check `hasCompletedProfile` returns correct profile
3. Ensure user has completed profile setup
4. Check browser console for errors

### Deactivated User Can Still Access
1. Verify `isActive` field is `false` in database
2. Check `App.tsx` routing logic
3. Clear browser cache and cookies
4. Verify user is signed out and signs back in

---

## Support and Maintenance

### Regular Maintenance Tasks
- Clean up expired verification codes (automatic)
- Monitor Resend email quota
- Review admin audit logs
- Check for inactive users

### Monitoring
- Email delivery rates
- Verification success rates
- Admin action frequency
- User activation/deactivation trends

---

## Version History

### Version 1.0.0 (Current)
- Email verification system implemented
- Profile setup flow fixed
- Account deletion with hard delete
- Admin dashboard complete
- Account deactivation system

---

## Contributors

This documentation covers all implementations made for the Diabetes Risk Prediction System, including email verification, profile management, account deletion, and admin dashboard features.

---

---

## Two-Factor Authentication (2FA) System

### Overview
Implemented a comprehensive two-factor authentication system to enhance account security. The system supports both TOTP (Time-based One-Time Password) via authenticator apps and SMS-based verification codes.

### Technology Stack
- **TOTP Implementation**: RFC 6238 standard with HMAC-SHA1
- **QR Code Generation**: `qrcode` library for TOTP setup
- **Base32 Encoding**: `base32-encode` and `base32-decode` for TOTP secrets
- **Node.js Crypto**: For secure random number generation
- **Session Management**: Browser sessionStorage for verification tracking

### Implementation Details

#### 1. Database Schema Updates

**File**: `convex/schema.ts`

**Added to `userProfiles` table:**
```typescript
// Two-factor authentication (2FA) - Enhanced security feature
enable2FA: v.optional(v.boolean()),
twoFactorMethod: v.optional(v.union(v.literal("totp"), v.literal("sms"))),
totpSecret: v.optional(v.string()), // Base32-encoded TOTP secret (encrypt in production)
totpBackupCodes: v.optional(v.array(v.string())), // Backup codes for account recovery
smsVerified: v.optional(v.boolean()), // SMS number verification status
```

**Updated `verificationCodes` table:**
```typescript
type: v.union(
  v.literal("email_verification"), 
  v.literal("password_reset"),
  v.literal("2fa_sms") // SMS verification codes for 2FA
),
userId: v.optional(v.id("users")), // User ID for 2FA SMS codes (indexed for quick lookup)
```

#### 2. Backend Functions

**File**: `convex/twoFactorAuth.ts` (V8 Runtime)

**Queries:**
- `get2FAStatus` - Returns current 2FA status (enabled, method, backup codes count, SMS verified)

**Mutations:**
- `enableTOTP2FA` - Stores TOTP secret and backup codes after verification
- `storeSMSCode` - Stores SMS verification code (6-digit, 10-minute expiration)
- `verifySMSCode` - Verifies SMS code with rate limiting (max 5 attempts)
- `disable2FA` - Disables 2FA and clears all related data
- `removeBackupCode` - Removes used backup code from user profile
- `enableSMS2FA` - Enables SMS-based 2FA (requires phone number)

**File**: `convex/twoFactorAuthActions.ts` (Node.js Runtime - "use node")

**Actions:**
- `generateTOTPSecret` - Generates cryptographically secure TOTP secret (20 bytes) and 10 backup codes
- `verifyTOTPSetup` - Verifies TOTP code during initial setup
- `verifyTOTPCode` - Verifies TOTP code during sign-in (checks current and adjacent time windows)
- `sendSMSCode` - Generates and sends 6-digit SMS code (currently logs to console)

**Helper Functions:**
- `generateBackupCodes` - Generates 10 random 8-digit backup codes
- `verifyTOTPCodeHelper` - TOTP verification with clock skew tolerance (±30 seconds)
- `generateTOTP` - TOTP code generation using HMAC-SHA1 algorithm

#### 3. Frontend Components

**File**: `src/components/TwoFactorAuthSetup.tsx`

**Features:**
- Multi-step setup wizard (select → setup → verify → complete)
- Method selection (TOTP or SMS)
- QR code generation for TOTP setup
- Manual secret entry option
- Backup codes display with copy/download functionality
- SMS code verification interface

**Props:**
- `onClose: () => void` - Callback when user closes setup
- `onComplete: () => void` - Callback when setup completes

**File**: `src/components/TwoFactorVerificationModal.tsx`

**Features:**
- 6-digit code input with auto-formatting
- Resend SMS code functionality
- Loading states during verification
- Error handling with user-friendly messages
- Method-specific UI (TOTP vs SMS)

**Props:**
- `userId: Id<"users">` - User ID to verify code for
- `method: "totp" | "sms"` - 2FA method being used
- `phoneNumber?: string` - Phone number for SMS method (display only)
- `onVerify: () => void` - Callback when verification succeeds
- `onCancel: () => void` - Callback when user cancels

**File**: `src/components/TwoFactorGate.tsx`

**Features:**
- Wraps protected content and enforces 2FA verification
- Checks sessionStorage for previous verification
- Shows verification modal if 2FA enabled and not verified
- Signs out user if verification is cancelled
- Allows access once verified

**Props:**
- `children: React.ReactNode` - Content to protect
- `userId: Id<"users">` - User ID to check 2FA status for

#### 4. Integration Points

**File**: `src/App.tsx`

**Integration:**
- TwoFactorGate wraps all authenticated content
- Checks 2FA status after successful password authentication
- Shows verification modal if needed
- Allows access once verified

**File**: `src/components/ProfilePage.tsx`

**Integration:**
- 2FA management section in Account Settings
- Shows current 2FA status and method
- Enable/Disable buttons
- Opens TwoFactorAuthSetup component for setup

#### 5. TOTP Algorithm Implementation

**Standard**: RFC 6238 (TOTP)

**Parameters:**
- Algorithm: HMAC-SHA1
- Time Step: 30 seconds
- Code Length: 6 digits
- Clock Skew Tolerance: ±1 time window (±30 seconds)

**Process:**
1. Generate 20-byte random secret
2. Encode secret in base32
3. Calculate time counter: `floor(currentTime / 30)`
4. Create HMAC-SHA1 hash with secret and counter
5. Perform dynamic truncation
6. Generate 6-digit code: `hash % 1,000,000`

**Verification:**
- Checks current time window
- Also checks previous and next time windows (for clock skew)
- Returns true if code matches any window

#### 6. Security Features

**TOTP Security:**
- Cryptographically secure random secret generation
- Base32 encoding for compatibility
- HMAC-SHA1 for code generation
- Clock skew tolerance
- Single-use backup codes

**SMS Security:**
- 6-digit random codes
- 10-minute expiration
- Maximum 5 verification attempts
- Single-use codes (marked as used after verification)
- Automatic cleanup of expired codes

**Session Security:**
- Verification stored in sessionStorage (not localStorage)
- Cleared when browser session ends
- Key format: `2fa_verified_{userId}`
- Prevents repeated verification prompts

#### 7. User Experience

**Setup Flow:**
1. User navigates to Profile → Account Settings
2. Clicks "Enable" on Two-Factor Authentication
3. Selects method (TOTP or SMS)
4. For TOTP: Scans QR code or enters secret manually
5. Enters verification code
6. Views and saves backup codes (TOTP only)
7. Setup complete

**Sign-In Flow:**
1. User enters email and password
2. Password authentication succeeds
3. TwoFactorGate checks 2FA status
4. If enabled, verification modal appears
5. User enters 6-digit code
6. Code verified, access granted
7. Verification remembered for session

**Management:**
- View 2FA status in Profile
- See active method (TOTP or SMS)
- View backup codes count
- Disable 2FA (with confirmation)

#### 8. Error Handling

**TOTP Errors:**
- Invalid code → "Invalid verification code. Please try again."
- Missing secret → "TOTP secret not found"
- Method mismatch → "2FA not enabled or invalid method"

**SMS Errors:**
- Code expired → "Code has expired. Please request a new one."
- Too many attempts → "Too many attempts. Please request a new code."
- Invalid code → "Invalid code. X attempts remaining."
- No code found → "No verification code found. Please request a new one."

**Backup Code Errors:**
- Invalid backup code → Treated as regular TOTP code error
- Used backup code → Automatically removed after use

#### 9. Dependencies

**New Packages:**
```json
{
  "qrcode": "^1.5.3",
  "@types/qrcode": "^1.5.5",
  "base32-encode": "^2.0.0",
  "base32-decode": "^1.0.0"
}
```

**Installation:**
```bash
npm install qrcode @types/qrcode base32-encode base32-decode
```

#### 10. Production Considerations

**Required Changes:**
1. **Encrypt TOTP Secrets**: Currently stored as plain text. Should use encryption.
2. **SMS Service Integration**: Replace console.log with actual SMS service (Twilio, AWS SNS, etc.)
3. **Password Verification**: Add password verification before disabling 2FA
4. **Rate Limiting**: Add rate limiting for 2FA verification attempts
5. **Backup Code Regeneration**: Allow users to regenerate backup codes

**Environment Variables:**
- No new environment variables required (SMS service will need API keys when integrated)

#### 11. Testing

**Test Scenarios:**
1. Enable TOTP 2FA and verify setup
2. Enable SMS 2FA and verify setup
3. Sign in with TOTP code
4. Sign in with SMS code
5. Sign in with backup code
6. Disable 2FA
7. Verify session persistence
8. Test clock skew tolerance
9. Test code expiration
10. Test attempt limiting

**Manual Testing Required:**
- QR code scanning with authenticator app
- SMS code delivery (when SMS service integrated)
- Backup code usage
- Session management
- Error handling

---

## Patient Education Resources

### Overview
A comprehensive patient education system providing articles, videos, tips, guides, and external links to help patients learn about diabetes prevention and management.

### Technology Stack
- **Backend**: Convex queries and mutations
- **Frontend**: React component with filtering and search
- **Storage**: Convex database with soft delete support

### Implementation Details

#### 1. Database Schema

**File**: `convex/schema.ts`

**New Table: `educationResources`**
```typescript
educationResources: defineTable({
  title: v.string(),
  description: v.string(),
  content: v.string(),
  type: v.union(
    v.literal("article"),
    v.literal("video"),
    v.literal("tip"),
    v.literal("guide"),
    v.literal("link")
  ),
  category: v.union(
    v.literal("prevention"),
    v.literal("nutrition"),
    v.literal("exercise"),
    v.literal("medication"),
    v.literal("monitoring"),
    v.literal("complications"),
    v.literal("lifestyle"),
    v.literal("general")
  ),
  url: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
  author: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  isPublished: v.boolean(),
  publishedAt: v.optional(v.number()),
  createdBy: v.id("userProfiles"),
  viewCount: v.optional(v.number()),
  isDeleted: v.boolean(),
  order: v.optional(v.number()),
})
```

#### 2. Backend Functions

**File**: `convex/educationResources.ts`

**Queries:**
- `getPublishedResources` - Get published resources for patients (with filtering)
- `getResourceById` - Get single resource by ID
- `getAllResources` - Get all resources (admin only)

**Mutations:**
- `createResource` - Create new education resource
- `updateResource` - Update existing resource
- `deleteResource` - Soft delete resource
- `incrementViewCount` - Track resource views
- `seedSampleResources` - Seed initial sample content

#### 3. Frontend Components

**File**: `src/components/PatientEducationResources.tsx`

**Features:**
- Resource filtering by category and type
- Search functionality
- Resource cards with icons
- View tracking
- External link handling
- Responsive design

**File**: `src/components/AdminDashboard.tsx` (Education Tab)

**Features:**
- Full CRUD interface
- Resource form with all fields
- Tag management
- Publishing control
- Order management

---

## Advanced Analytics

### Overview
Enhanced analytics system providing comparative analysis, cohort studies, and predictive trends to help patients understand their health in context.

### Implementation Details

#### 1. Backend Functions

**File**: `convex/analytics.ts`

**Queries:**
- `getPopulationStatistics` - Get system-wide statistics for comparison
- `getCohortStatistics` - Get cohort-specific statistics (age, risk, gender)
- `getPredictiveTrends` - Get predictive trend analysis using linear regression

#### 2. Frontend Integration

**File**: `src/components/EnhancedPatientDashboard.tsx` (Analytics Tab)

**Sections:**
- **Comparative Analysis**: You vs. Population Average
- **Cohort Studies**: Age-based, Risk-based, Gender-based comparisons
- **Predictive Trends**: Future risk score predictions with charts

**Features:**
- Visual indicators (better/worse/similar)
- Statistical insights (mean, median, standard deviation)
- Trend charts with projections
- Confidence intervals

---

## Audit Log Viewer (Admin)

### Overview
Comprehensive audit log system for tracking all user actions for security and compliance.

### Implementation Details

#### 1. Backend Functions

**File**: `convex/admin.ts`

**Queries:**
- `getAuditLogs` - Get filtered audit logs with pagination
- `getAuditLogActions` - Get unique action types
- `getAuditLogUsers` - Get users with audit logs
- `getAuditLogStats` - Get audit log statistics

#### 2. Frontend Integration

**File**: `src/components/AdminDashboard.tsx` (Audit Logs Tab)

**Features:**
- Filter by user, action type, date range
- Search functionality
- Statistics display
- Action details view

---

## Medication Management

### Overview
Comprehensive medication tracking and reminder system with drug interaction warnings.

### Implementation Details

#### 1. Database Schema Updates

**File**: `convex/schema.ts`

**Updated `medications` table:**
```typescript
enableReminders: v.optional(v.boolean()),
reminderTimes: v.optional(v.array(v.string())),
```

**New Table: `medicationReminders`**
```typescript
medicationReminders: defineTable({
  medicationId: v.id("medications"),
  patientId: v.id("users"),
  reminderTime: v.string(), // HH:MM format
  isActive: v.boolean(),
  isDeleted: v.boolean(),
  sentAt: v.optional(v.number()),
  nextReminderAt: v.number(),
})
```

**New Table: `drugInteractions`**
```typescript
drugInteractions: defineTable({
  medication1: v.string(),
  medication2: v.string(),
  severity: v.union(v.literal("mild"), v.literal("moderate"), v.literal("severe")),
  description: v.string(),
})
```

#### 2. Backend Functions

**File**: `convex/medicationReminders.ts`

**Queries:**
- `getRemindersForMedication` - Get reminders for a medication
- `getUpcomingReminders` - Get all upcoming reminders for a patient
- `getDueReminders` - Get reminders due now (for cron job)

**Mutations:**
- `updateMedicationReminders` - Update reminder times
- `markReminderSent` - Mark reminder as sent
- `deleteMedicationReminder` - Delete a reminder
- `updateMedicationReminderTime` - Update single reminder time

**Actions:**
- `sendMedicationReminderNotification` - Send notification for a reminder
- `sendMedicationReminderNotifications` - Send all due reminders (cron)

**File**: `convex/drugInteractions.ts`

**Queries:**
- `checkInteractions` - Check for drug interactions

**Mutations:**
- `seedInteractions` - Seed initial interaction database

#### 3. Frontend Components

**File**: `src/components/EnhancedPatientDashboard.tsx` (MedicationTracker)

**Features:**
- Add/edit/delete medications
- Set reminder times (multiple per medication)
- View upcoming reminders
- Edit/delete individual reminders
- Test reminder functionality
- Drug interaction warnings

**File**: `src/components/NotificationBell.tsx`

**Features:**
- Notification center
- Medication reminder notifications
- Toast notifications
- Mark as read functionality

#### 4. Cron Jobs

**File**: `convex/crons.ts`

**Hourly Medication Reminder Check:**
- Checks for due medication reminders
- Sends in-app and email notifications
- Marks reminders as sent

---

## Assessment Reminders

### Overview
System to schedule and send reminders for follow-up health assessments.

### Implementation Details

#### 1. Backend Functions

**File**: `convex/reminders.ts`

**Queries:**
- `getRemindersForPatient` - Get all reminders for a patient
- `getUpcomingReminders` - Get upcoming reminders

**Mutations:**
- `createReminder` - Create new reminder
- `updateReminder` - Update reminder
- `deleteReminder` - Delete reminder
- `markReminderSent` - Mark reminder as sent
- `updateReminderAfterAssessment` - Update reminder after assessment

**Actions:**
- `sendReminderEmail` - Send reminder email
- `sendReminderNotifications` - Send reminder notifications (cron)

#### 2. Frontend Components

**File**: `src/components/AssessmentReminderSection.tsx`

**Features:**
- Create reminders with frequency selection
- View upcoming reminders
- Edit/delete reminders
- Reminder status display

---

## Messaging System

### Overview
Real-time messaging system for communication between patients and their assigned doctors.

### Implementation Details

#### 1. Backend Functions

**File**: `convex/messages.ts`

**Queries:**
- `getConversation` - Get messages between two users
- `getConversations` - Get all conversations for a user
- `getUnreadMessageCount` - Get unread message count

**Mutations:**
- `sendMessage` - Send a message
- `markMessagesAsRead` - Mark messages as read
- `deleteMessage` - Delete a message

#### 2. Frontend Components

**File**: `src/components/Messaging.tsx`

**Features:**
- Conversation list
- Message display with timestamps
- Send message interface
- Read status indicators
- Message deletion
- Real-time updates

---

## Support System

### Overview
Support ticket system for users to contact administrators for help.

### Implementation Details

#### 1. Backend Functions

**File**: `convex/support.ts`

**Queries:**
- `getAllSupportMessages` - Get all support messages (admin)
- `getUnreadSupportCount` - Get unread support message count

**Mutations:**
- `submitSupportMessage` - Submit new support request
- `markSupportMessageAsRead` - Mark message as read
- `updateSupportMessageStatus` - Update status
- `respondToSupportMessage` - Admin response
- `deleteSupportMessage` - Delete message

#### 2. Frontend Components

**File**: `src/components/SupportModal.tsx`

**Features:**
- Support request form
- Status tracking
- Admin response interface

---

## Password Reset

### Overview
Secure password reset system using email verification codes.

### Implementation Details

#### 1. Backend Functions

**File**: `convex/passwordReset.ts`

**Queries:**
- `getUserByEmail` - Get user by email

**Mutations:**
- `createPasswordResetCode` - Generate reset code
- `verifyPasswordResetCode` - Verify code
- `resetPassword` - Reset password with new hash

**Actions:**
- `hashPassword` - Hash password with bcryptjs

**File**: `convex/passwordResetHelpers.ts`

**Utilities:**
- Password hashing functions
- Code generation

#### 2. Frontend Components

**File**: `src/components/PasswordResetModal.tsx`

**Features:**
- Email input
- Code verification
- New password entry
- Error handling

---

## Print & Export Functionality

### Overview
Print and export functionality for assessments and medical records.

### Implementation Details

#### 1. Utility Functions

**File**: `src/utils/printUtils.ts`

**Functions:**
- `printAssessment` - Print formatted assessment report
- `printMedicalRecord` - Print medical record

**Features:**
- Detailed health factors
- Professional formatting
- Print-optimized CSS

**File**: `src/utils/exportData.ts`

**Functions:**
- `exportToPDF` - Export to PDF using jsPDF
- `exportToCSV` - Export to CSV

**Features:**
- Complete data export
- Formatted output
- Audit logging

---

## Error Boundaries

### Overview
React Error Boundaries to catch and handle UI errors gracefully.

### Implementation Details

**File**: `src/components/ErrorBoundary.tsx`

**Features:**
- Error catching
- Fallback UI
- Error reporting
- Recovery options

**Integration:**
- Wrapped in `src/App.tsx`

---

## Email Notifications

### Overview
Comprehensive email notification system for important events.

### Implementation Details

**File**: `convex/emails.ts`

**Email Functions:**
- `sendAssessmentResultEmail` - Assessment completion
- `sendAssignmentNotificationEmail` - Doctor assignment updates
- `sendHighRiskAlertEmail` - High-risk alerts
- `sendNewMessageEmail` - New messages
- `sendReminderEmail` - Assessment reminders
- `sendMedicationReminderEmail` - Medication reminders
- `sendSupportResponseEmail` - Support responses

**Account Settings:**
- `emailNotifications` toggle in Profile
- Users can opt-in/opt-out

---

## Doctor Report Generation

### Overview
Comprehensive PDF report generation for patient health summaries.

### Implementation Details

**File**: `convex/reports.ts`

**Functions:**
- `getPatientReportData` - Get data for report
- `generatePatientReportPDF` - Generate PDF report

**File**: `src/utils/reportUtils.ts`

**Features:**
- Report formatting
- PDF generation
- Data aggregation

---

## Notification System

### Overview
Comprehensive in-app notification system with notification bell.

### Implementation Details

**File**: `src/components/NotificationBell.tsx`

**Features:**
- Notification center
- Badge count
- Toast notifications
- Mark as read
- Auto-dismiss

**Backend:**
- `dashboard.markNotificationAsRead` (mutation)
- `dashboard.markAllNotificationsAsRead` (mutation)

---

## Enhanced Tooltip System

### Overview
Comprehensive enhancement of the tooltip system across the application, providing users with detailed, structured information about medical metrics and risk factors. The system includes dual tooltip functionality - one for detailed explanations and one for quick metrics overview.

### Implementation Details

#### 1. New Assessment Form Tooltips

**File**: `src/components/EnhancedMedicalRecordForm.tsx`

**Structure**:
Each tooltip uses a structured format with:
- **Title**: Clear heading (e.g., "Fasting Blood Glucose")
- **Description**: What the metric measures
- **Normal Range**: Reference values with categories
- **Diabetes Risk**: How it relates to diabetes risk

**Example Tooltip Data**:
```typescript
const tooltipCopy = {
  glucose: {
    title: "Fasting Blood Glucose",
    description: "Your blood sugar level after fasting (not eating) for at least 8 hours...",
    normalRange: "Normal: 70-100 mg/dL | Prediabetes: 100-125 mg/dL | Diabetes: 126+ mg/dL",
    diabetesRisk: "Elevated glucose levels indicate your body may not be processing sugar correctly..."
  },
  // ... more fields
}
```

**Fields with Tooltips**:
- BMI, Glucose Level, Systolic BP, Diastolic BP
- Insulin Level, Skin Thickness, HbA1c, Pregnancies
- Heart Rate, Family History, Smoking Status
- Alcohol Consumption, Exercise Frequency

**Technical Implementation**:
- Uses `@radix-ui/react-tooltip` for accessible tooltips
- Conditional rendering for simple vs. structured tooltips
- Color-coded sections (Blue for Normal Range, Amber for Diabetes Risk)
- Responsive sizing and positioning

#### 2. Analytics Key Risk Factors Tooltips

**Files**: 
- `src/components/EnhancedPatientDashboard.tsx`
- `src/components/EnhancedDoctorDashboard.tsx`

**Dual Tooltip System**:

**A. Info Icon Tooltip (Left Side)**
- Triggered only when hovering/clicking the info icon
- Shows enhanced explanations with:
  - Title
  - Description
  - Normal Range
  - Diabetes Risk information
- Dark background (gray-900) for contrast

**B. Bar/Right Side Tooltip (Hover)**
- Triggered when hovering over:
  - Progress bar (colored bar showing importance %)
  - Current value area (right side with numeric value)
  - Status icon (green/yellow/red indicator)
- Shows detailed metrics:
  - Current Value
  - Normal Range
  - Risk Impact (percentage)
  - Comparison with Previous Assessment (if available)
  - Visual Range Bar with indicator
- White background for better readability
- Does NOT trigger when hovering over left side (factor name + info icon)

**Tooltip Data Structure**:
```typescript
const factorExplanations: Record<string, {
  title: string;
  description: string;
  normalRange?: string;
  diabetesRisk: string;
}> = {
  bmi: {
    title: "Body Mass Index (BMI)",
    description: "A measure of body fat based on your height and weight...",
    normalRange: "Healthy: 18.5-24.9 | Overweight: 25-29.9 | Obese: 30+",
    diabetesRisk: "Higher BMI increases diabetes risk..."
  },
  // ... 15+ more factors
}
```

**Risk Factors Covered**:
- BMI, Glucose, Blood Pressure, Age
- Insulin Level, Skin Thickness
- Diabetes Pedigree Function, Pregnancies
- Glucose to BMI Ratio, Age × BMI Interaction
- Blood Pressure Category, Glucose Category
- BMI Category, Metabolic Risk Score
- Insulin to Glucose Ratio

#### 3. Hover Behavior Implementation

**Smart Tooltip Triggering**:
- Left side (factor name + info icon): No tooltip on hover
- Bar and right side: Detailed tooltip on hover
- Info icon: Separate tooltip on hover/click

**Technical Details**:
- Wrapped bar, value, and status icon in `RadixTooltip.Root` and `RadixTooltip.Trigger`
- Added `cursor-help` class to indicate hoverable areas
- Separate `RadixTooltip.Root` for info icon
- Proper z-index management for tooltip layering

**Files Modified**:
- `src/components/EnhancedPatientDashboard.tsx` - Dual tooltip system
- `src/components/EnhancedDoctorDashboard.tsx` - Dual tooltip system

---

## Global Population Averages Implementation

### Overview
Updated the Comparative Analysis and Cohort Studies to use real-world global population averages instead of website user data, providing more meaningful and medically accurate comparisons.

### Implementation Details

#### 1. Population Statistics Query

**File**: `convex/analytics.ts`

**Function**: `getPopulationStatistics`

**Changes**:
- Replaced user data aggregation with real-world global averages
- Based on WHO, CDC, and global health statistics
- Returns fixed values representing global population

**Global Averages**:
- Average Risk Score: 13.5% (based on global diabetes prevalence ~9.3% + prediabetes ~7.5%)
- Average Glucose: 95 mg/dL (global average fasting glucose)
- Average BMI: 24.8 kg/m² (WHO global average)
- Average Systolic BP: 125 mmHg (WHO global average)
- Average Diastolic BP: 78 mmHg (WHO global average)

**Risk Distribution** (based on global statistics):
- Low risk (<20%): ~75% of population
- Moderate risk (20-50%): ~15% of population
- High risk (50-75%): ~7% of population
- Very high risk (75%+): ~3% of population

#### 2. Cohort Statistics Query

**File**: `convex/analytics.ts`

**Function**: `getCohortStatistics`

**Changes**:
- Returns age-based global statistics instead of user data
- Age groups with global averages:
  - 18-29: Risk 8.5%, Glucose 88 mg/dL, BMI 23.5
  - 30-39: Risk 10.2%, Glucose 92 mg/dL, BMI 24.2
  - 40-49: Risk 13.8%, Glucose 96 mg/dL, BMI 25.1
  - 50-59: Risk 18.5%, Glucose 99 mg/dL, BMI 25.8
  - 60-69: Risk 22.3%, Glucose 102 mg/dL, BMI 26.2
  - 70+: Risk 25.8%, Glucose 105 mg/dL, BMI 25.5

**Features**:
- Highlights user's age cohort with `isUserCohort` flag
- Always shows all age groups for comprehensive comparison
- Based on real-world medical research data

#### 3. Frontend Updates

**File**: `src/components/EnhancedPatientDashboard.tsx`

**Changes**:
- Updated UI text to reflect "Global Average" instead of patient count
- Changed "You vs. Average Population" to indicate global comparison
- Updated "Age-based (Average Population)" for cohort studies
- Maintained user cohort highlighting functionality

**Benefits**:
- More medically accurate comparisons
- Consistent data regardless of user base size
- Based on established medical research
- Better context for users to understand their risk

---

## Chart Zoom Functionality

### Overview
Implemented click-to-zoom functionality for analytics charts in the doctor dashboard, matching the patient dashboard experience.

### Implementation Details

#### 1. Doctor Dashboard Chart Zoom

**File**: `src/components/EnhancedDoctorDashboard.tsx`

**Features**:
- Click-to-zoom for Glucose, BMI, and Blood Pressure charts
- Full-screen modal with larger charts
- Detailed table of all assessment values in zoom modal
- Removed values below charts in normal view (kept in zoom modal)
- Smooth animations and transitions

**Technical Implementation**:
- Added `zoomedChart` state to track which chart is zoomed
- Wrapped charts in clickable containers with hover effects
- Zoom icon appears on hover
- Modal with full-screen chart and detailed data table
- Click outside or close button to exit zoom

**Files Modified**:
- `src/components/EnhancedDoctorDashboard.tsx` - Added zoom functionality
- Added `ZoomIn` and `XIcon` imports from `lucide-react`
- Added `Legend` import from `recharts`

**Consistency**:
- Matches patient dashboard zoom functionality
- Same modal design and behavior
- Consistent user experience across dashboards

---

**Last Updated**: January 2025  
**Document Version**: 1.5.0


