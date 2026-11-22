const env = import.meta.env;

export const webConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
export const vapidKey = env.VITE_FIREBASE_VAPID_KEY;
export const pushConfigured = env.PROD && Boolean(vapidKey && messagingSenderId);
