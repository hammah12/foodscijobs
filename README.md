# FoodSci Apply

A job application assistant for entry-level Food Science graduates. It searches real job listings, scores them against your profile, generates tailored CV bullets, cover letters, and application form answers with Gemini, and tracks every application through a kanban pipeline.

## What it does (and what it doesn't)

- **Live job discovery** — searches real listings via the [Adzuna API](https://developer.adzuna.com) using your configured keywords and location, then Gemini scores each result against your profile.
- **AI tailoring** — for any job (searched or pasted manually), Gemini generates a fit score, rationale, qualification gaps, tailored CV content, a cover letter, and pre-filled form answers. Content is grounded in your saved profile; always review before sending.
- **Apply Assistant** — a copy-paste helper that opens the real job posting and lets you copy each piece of the package into the employer's form. **Nothing is auto-submitted**; you apply yourself and then mark the application as submitted.
- **Tracking** — kanban pipeline (queue → approved → submitted → interview → offer), per-application notes and reference IDs, and CSV export.

## Setup

Prerequisites: Node.js 20+.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
   - `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` — free at https://developer.adzuna.com (needed for the live job search; everything else works without them)
   - `AUTHORIZED_ADMINS` — comma-separated Google emails allowed to sign in
3. Firebase (auth + optional cloud sync), configured via `firebase-applet-config.json`:
   - In the [Firebase Console](https://console.firebase.google.com) for the project, enable **Authentication → Sign-in method → Google**.
   - Add your app's domain (e.g. `localhost`) under **Authentication → Settings → Authorized domains**.
   - Firestore sync is optional; without it the app stores data in `data/db.json`.
4. Run: `npm run dev` and open http://localhost:3000

## How auth works

Sign-in is real Google OAuth via Firebase Auth. The browser attaches a Firebase ID token to every API request; the server verifies the token signature with Firebase Admin and checks the verified email against `AUTHORIZED_ADMINS`. Requests without a valid token are rejected.

## Scripts

- `npm run dev` — dev server (Express + Vite middleware) on port 3000
- `npm run build` — production build (client + server bundle in `dist/`)
- `npm start` — run the production build
- `npm run lint` — TypeScript typecheck
