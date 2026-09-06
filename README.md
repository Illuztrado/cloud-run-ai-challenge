# Gemini Reflection Journal — Production Deployment & Security Guide

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

### 3.2 Deploy Owner-Bound Security Rules (`firestore.rules`)
Deploy strict, zero-insecure-default rules ensuring that authenticated users can only access their own user records, journal entries, and interaction sessions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profile document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Personal journal reflections
      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // Direct interactions path for AI interaction sessions and telemetry
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
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
- **Model Fallback Ladder**: Backend endpoints route through `generateContentWithFallback` sequentially cascading across `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`, `gemini-3.6-flash`, and `gemini-3.7-flash` when encountering recoverable `503`, `429`, `404`, or `500` status codes.
- **Payload & Data Hygiene**:
  - Top-level JSON request body parser mounted before all endpoints.
  - Defensive payload ingestion guarding against missing or malformed request objects.
  - Undefined-stripping sanitizer ensuring no `undefined` values trigger Firestore driver rejections.
  - UI error escalation with retry save workflows for complete persistence integrity.
