import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";
import { messagingSenderId, pushConfigured, webConfig } from "./firebase-config";

// FCM displays background notifications and uses the message's HTTPS link on click.
if (pushConfigured) getMessaging(initializeApp({ ...webConfig, messagingSenderId }));
