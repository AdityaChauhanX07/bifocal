import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { pageOrigins } from "./lib/page-checks";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  hooks: {
    "build:manifestGenerated": (_wxt, manifest) => {
      // Website checks register at runtime only after the user grants access.
      manifest.host_permissions = manifest.host_permissions?.filter((origin: string) => !pageOrigins.includes(origin));
    },
  },
  manifest: () => ({
    name: "Bifocal",
    description: "Spot warning signs in messages and pause before taking a risky action.",
    minimum_chrome_version: "139",
    permissions: ["sidePanel", "storage", "scripting", ...(process.env.WXT_GOOGLE_CLIENT_ID ? ["identity" as const] : [])],
    optional_host_permissions: pageOrigins,
    action: { default_title: "Open Bifocal" },
    ...(process.env.WXT_EXTENSION_KEY ? { key: process.env.WXT_EXTENSION_KEY } : {}),
    ...(process.env.WXT_GOOGLE_CLIENT_ID ? {
      oauth2: {
        client_id: process.env.WXT_GOOGLE_CLIENT_ID,
        scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
      },
    } : {}),
  }),
});
