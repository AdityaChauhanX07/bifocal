import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential, signOut } from "firebase/auth/web-extension";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const env: Partial<ImportMetaEnv> = import.meta.env.WXT_BIFOCAL_JUDGE_DEMO === "true" ? {} : import.meta.env;
export const emulatorMode = import.meta.env.MODE === "emulator";
const config = {
  apiKey: env.WXT_FIREBASE_API_KEY as string | undefined,
  authDomain: env.WXT_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.WXT_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.WXT_FIREBASE_APP_ID as string | undefined,
};

const appCheckUrl = URL.parse(env.WXT_APP_CHECK_URL ?? "");
export const liveFirebase = !emulatorMode && Object.values(config).every(Boolean) && !!env.WXT_GOOGLE_CLIENT_ID;
export const hasCloud = liveFirebase && appCheckUrl?.protocol === "https:";
export const approvedCloudEnabled = hasCloud && env.WXT_ENABLE_APPROVED_CLOUD === "true";

export const firebaseApp = emulatorMode
  ? initializeApp({ apiKey: "demo-bifocal", projectId: "demo-bifocal", appId: "demo-bifocal-extension" }, "bifocal-emulator")
  : liveFirebase ? initializeApp(config, "bifocal-extension") : undefined;
export const auth = firebaseApp && getAuth(firebaseApp);
export const db = firebaseApp && getFirestore(firebaseApp);

if (emulatorMode && auth && db) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

if (liveFirebase && firebaseApp && auth && appCheckUrl?.protocol === "https:") {
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
  if (emulatorMode) {
    const fixture = { sub: "bifocal-local-owner", email: "owner@example.test", email_verified: true };
    await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify(fixture)));
    return;
  }
  const { token } = await chrome.identity.getAuthToken({ interactive: true });
  if (!token) throw new Error("Google did not return a sign-in token");
  await signInWithCredential(auth, GoogleAuthProvider.credential(null, token));
}

export async function signOutAccount() {
  if (!auth) return;
  await signOut(auth);
  if (liveFirebase) await chrome.identity.clearAllCachedAuthTokens();
}
