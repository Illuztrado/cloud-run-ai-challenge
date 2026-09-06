# Ride Check — Production Deployment & Security Guide

A private, user-authenticated journaling and multi-turn AI reflection platform built with Express, Vite, React 19, Google Cloud Firestore, and the Gemini API (`@google/genai`).

---

## 1. Environment & Prerequisites

Ensure you have administrative access to a Google Cloud project with billing enabled, along with the Google Cloud SDK (`gcloud`) and Firebase CLI installed.

### 1.1 Enable Required Google Cloud APIs
Run the following command to enable Cloud Run, Secret Manager, Cloud Build, and Cloud Firestore:

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 1.2 Configure Project and Region
```bash
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="asia-east1" # Or us-central1, etc.
export SERVICE_NAME="gemini-reflection-journal"

gcloud config set project $PROJECT_ID
```

---

## 2. Secret Management Setup (Zero-Hardcoding Hygiene)

API credentials must never be committed to source code or baked directly into container images. Manage `GEMINI_API_KEY` using Google Cloud Secret Manager.

### 2.1 Create and Populate the Secret
```bash
# Create the secret definition in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# Add the secret version containing your Gemini API Key
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
```

### 2.2 Grant Access to Cloud Run Runtime Service Account
Find your project number and bind the `secretmanager.secretAccessor` IAM role to the default compute service account utilized by Cloud Run:

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Database Security Configuration (Cloud Firestore)

The application uses Google Cloud Firestore for user-isolated persistence.

### 3.1 Provision Firestore in Native Mode
If not already provisioned:
```bash
gcloud firestore databases create --location=$REGION --type=firestore-native
```

### 3.2 Deploy Owner-Bound & RBAC Security Rules (`firestore.rules`)
Deploy strict, zero-insecure-default rules ensuring that authenticated users can only access their own user records and personal journal entries, while administrators are granted access to user lifecycle management and platform telemetry with zero direct access to personal reflections:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    // ZERO-READ CHECK: Reads role claim directly from cryptographically signed JWT
    // Includes bootstrapped project owner email verification
    function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.role == 'admin' ||
        (request.auth.token.email == 'canindojp@gmail.com' && request.auth.token.email_verified == true)
      );
    }

    // User profile documents
    match /users/{userId} {
      // Owners can read their profile; Admins can read user profiles for management
      allow read: if isOwner(userId) || isAdmin();

      // Standard users can update their profile, but are strictly forbidden from self-assigning or changing 'role'
      allow create: if isOwner(userId) && (!('role' in request.resource.data) || request.resource.data.role == 'user');
      allow update: if isOwner(userId) && (!('role' in request.resource.data) || request.resource.data.role == resource.data.role);
      
      // Administrators have write permissions on user profiles (e.g. updating roles or account flags)
      allow write: if isAdmin();

      // User personal journal entries: strict isolation (admins cannot read personal reflections)
      match /entries/{entryId} {
        allow read, write: if isOwner(userId);
      }

      // Direct interactions path for AI interaction sessions
      match /interactions/{interactionId} {
        allow read, write: if isOwner(userId);
      }
    }

    // Administrative metrics & telemetry collections
    match /admin_metrics/{document=**} {
      allow read, write: if isAdmin();
    }
  }
}
```

Deploy the rules using Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Cloud Run Deployment Flow

### 4.1 Build and Deploy
Deploy the unified full-stack application directly to Google Cloud Run, injecting the Secret Manager secret at runtime:

```bash
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 3000 \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1
```

---

## 5. Required Campaign Verification Binding

To register and verify the deployed Cloud Run service for automated challenge verification, apply the mandatory label:

```bash
gcloud run services update $SERVICE_NAME \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION
```

Confirm the label was successfully applied:
```bash
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(metadata.labels)"
```

---

## 6. Architecture & Security Overview

- **Frontend & Backend Architecture**: React 19 SPA served via Vite middleware inside an Express backend on Node 22, compiled to `dist/server.cjs` for production.
- **Hybrid RBAC Architecture (Custom Claims + Document Sync)**:
  - **Primary Authorization**: High-frequency checks in `firestore.rules` (`request.auth.token.role == 'admin'`) and Express middleware (`decodedToken.role === 'admin'`) inspect cryptographically signed JWT Custom Claims with **zero billable Firestore read** operations.
  - **Metadata & Audit Layer**: User profiles in `/users/{userId}` mirror role data (`role`, `roleUpdatedAt`) for console visibility and directory querying.
  - **Zero Client Mutation**: Custom claims can only be mutated server-side via the Firebase Admin SDK (`getAuth().setCustomUserClaims()`). Standard users are mathematically forbidden by Firestore rules from elevating their own `role` field.
  - **Zero Direct Access Invariant**: Administrators have full access to platform telemetry, user lifecycle, and role assignment, but are strictly blocked by Firestore rules from reading users' private journal reflections (`/users/{userId}/entries/*`).
  - **Forced Token Refresh**: Client utilizes `user.getIdToken(true)` to immediately apply updated claims without waiting for 60-minute token expiration.
- **Model Fallback Ladder**: Backend endpoints route through `generateContentWithFallback` sequentially cascading across `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`, `gemini-3.6-flash`, and `gemini-3.7-flash` when encountering recoverable `503`, `429`, `404`, or `500` status codes.
- **Payload & Data Hygiene**:
  - Top-level JSON request body parser mounted before all endpoints.
  - Defensive payload ingestion guarding against missing or malformed request objects.
  - Undefined-stripping sanitizer ensuring no `undefined` values trigger Firestore driver rejections.
  - UI error escalation with retry save workflows for complete persistence integrity.

---

## 7. Functional & Security Verification Walkthroughs

The following test walkthroughs can be executed manually or transcribed into automated end-to-end test suites:

### Walkthrough 1: Admin Dashboard Navigation & Claim Verification
1. **Pre-condition**: Sign in with an account having `canindojp@gmail.com` or custom claim `role: 'admin'`.
2. **Action**: Observe the Navbar. Verify that an amber **Admin** badge and an **Admin Console** button appear.
3. **Action**: Click **Admin Console**.
4. **Expected Result**: The Admin Console mounts cleanly, displaying the **User Directory**, **Telemetry & Health**, and **Audit Log** tabs.
5. **Action**: Click **Back to Journal**.
6. **Expected Result**: Workspace view restores seamlessly with the active reflection intact.

### Walkthrough 2: Non-Admin Access Control & Guard Rejection (403 Forbidden)
1. **Pre-condition**: Sign in with a standard non-admin account (`role: 'user'`).
2. **Action**: Attempt to access the Admin Console or send an unauthorized `GET /api/admin/users` request.
3. **Expected Result**:
   - UI: `<AdminGuard>` renders the **403 Forbidden: Elevated Privileges Required** screen with zero exposure of sensitive administrative tables.
   - API: Express middleware rejects the request with HTTP `403 Forbidden` and `error: 'Forbidden: Elevated administrative privileges required.'`.
   - Security Audit: Non-admin attempt is logged with a security alert in backend telemetry.

### Walkthrough 3: Role Elevation & Custom Claims Synchronization
1. **Pre-condition**: Sign in as an authorized admin on the Admin Console.
2. **Action**: Locate a user in the **User Directory & Roles** table.
3. **Action**: Change the user's role from `user` to `moderator` or `admin` using the dropdown.
4. **Expected Result**:
   - Backend sets the cryptographically signed Custom Claim via Firebase Admin SDK.
   - Backend merges `{ role: newRole, roleUpdatedAt: timestamp }` into `/users/{targetUserId}` in Firestore.
   - An immutable audit log entry is saved to `/admin_metrics/audit_logs/events`.
   - UI displays a success banner confirming the role elevation.
   - Switching to the **RBAC Audit Log** tab displays the new event with actor, target UID, and timestamps.

### Walkthrough 4: Force Token Refresh Workflow
1. **Pre-condition**: User has their role updated on the server.
2. **Action**: Click the **Force Token Refresh** button in the Admin Console or Admin Guard.
3. **Expected Result**:
   - Client invokes `user.getIdToken(true)`, bypassing the default 60-minute JWT client cache.
   - New claims are fetched and verified in-memory immediately.

### Walkthrough 5: Zero Direct Access Privacy Boundary Test
1. **Pre-condition**: Authenticated as an admin.
2. **Action**: In the user directory, verify that only account metadata (UID, email, display name, role, last login) is presented.
3. **Action**: Inspect network activity or attempt a query to `/users/{otherUserId}/entries`.
4. **Expected Result**: Firestore security rules block the query, enforcing that personal reflections remain 100% private to each user.
