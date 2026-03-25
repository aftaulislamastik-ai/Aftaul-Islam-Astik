# Commune - Cyber Messaging App

A futuristic, high-performance messaging application built with React, Vite, and Firebase.

## Features

- **Real-time Messaging:** Instant communication powered by Firestore.
- **Cyberpunk UI:** Modern, immersive design with animations.
- **Google Authentication:** Secure login with Google.
- **Account Management:** Full control over your profile and data.
- **Identity Purge:** Complete account and chat deletion for privacy.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Firebase Project

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd commune-cyber-messaging
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Firebase:**
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/).
   - Enable **Authentication** (Google Sign-In).
   - Enable **Firestore Database**.
   - Create a web app in your Firebase project and copy the configuration.
   - Create a `.env` file in the root directory and add your Firebase credentials (see `.env.example` for reference):
     ```env
     VITE_FIREBASE_API_KEY=your_api_key
     VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
     VITE_FIREBASE_PROJECT_ID=your_project_id
     VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
     VITE_FIREBASE_DATABASE_ID=(default)
     GEMINI_API_KEY=your_gemini_api_key
     ```

4. **Deploy Firestore Rules:**
   - Copy the content of `firestore.rules` and paste it into the **Rules** tab of your Firestore Database in the Firebase Console.

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. **Build for production:**
   ```bash
   npm run build
   ```

## Deployment

### Netlify

This project is pre-configured for Netlify. Simply connect your GitHub repository to Netlify and it will automatically deploy using the settings in `netlify.toml`.

**Important:** Make sure to add your environment variables in the Netlify dashboard under **Site settings > Build & deploy > Environment variables**.

## License

MIT
