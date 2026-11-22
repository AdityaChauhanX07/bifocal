import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const env = import.meta.env;

export function connectFirebase() {
  const local = env.DEV && env.VITE_FIREBASE_MODE !== "live";
  const config = local
    ? {
        apiKey: "demo-bifocal",
        authDomain: "demo-bifocal.firebaseapp.com",
        projectId: "demo-bifocal",
        appId: "demo-bifocal-web",
      }
    : {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      };

  if (Object.values(config).some((value) => !value)) return null;

  const app = initializeApp(config);
  if (!local && env.VITE_FIREBASE_APP_CHECK_SITE_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(env.VITE_FIREBASE_APP_CHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const auth = getAuth(app);
  const db = getFirestore(app);
  if (local) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return { auth, db };
}
