import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth/web-extension";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";
import { getFirestore } from "firebase/firestore";

const env = import.meta.env;
const config = {
  apiKey: env.WXT_FIREBASE_API_KEY as string | undefined,
  authDomain: env.WXT_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.WXT_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.WXT_FIREBASE_APP_ID as string | undefined,
};

const appCheckUrl = URL.parse(env.WXT_APP_CHECK_URL ?? "");
export const liveFirebase = Object.values(config).every(Boolean) && !!env.WXT_GOOGLE_CLIENT_ID;
export const hasCloud = liveFirebase && appCheckUrl?.protocol === "https:";
export const approvedCloudEnabled = hasCloud && env.WXT_ENABLE_APPROVED_CLOUD === "true";

export const firebaseApp = liveFirebase ? initializeApp(config, "bifocal-extension") : undefined;
export const auth = firebaseApp && getAuth(firebaseApp);
export const db = firebaseApp && getFirestore(firebaseApp);

if (firebaseApp && auth && appCheckUrl?.protocol === "https:") {
  const extensionAuth = auth;
  const tokenEndpoint = appCheckUrl.href;
  initializeAppCheck(firebaseApp, {
    provider: new CustomProvider({
      async getToken() {
        await extensionAuth.authStateReady();
        const user = extensionAuth.currentUser;
        if (!user || !navigator.onLine) throw new Error("Sign in online to use cloud checks");
        const response = await fetch(tokenEndpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error("App Check could not verify the extension");
        const { token, expireTimeMillis } = await response.json();
        if (typeof token !== "string" || !Number.isFinite(expireTimeMillis) || expireTimeMillis <= Date.now()) {
          throw new Error("Invalid App Check token response");
        }
        return { token, expireTimeMillis };
      },
    }),
  });
}

export async function signIn() {
  if (!auth || !navigator.onLine) throw new Error("Google sign-in unavailable");
  const { token } = await chrome.identity.getAuthToken({ interactive: true });
  if (!token) throw new Error("Google did not return a sign-in token");
  await signInWithCredential(auth, GoogleAuthProvider.credential(null, token));
}
