import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { pageOrigins } from "./lib/page-checks";

// The unpacked ZIP needs the same OAuth and App Check origin on every machine.
const releaseKey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu90ieikzi+0d8jU+BXUCqOKQqtS1OPtbFuDbRVpP1/rQ2+ejT5RnGke87EwTvVv4F5Nn1pVyp8gazQcNmY4CZLMLjDn2ITf612TYW1JMvoGVPE/mXuF6ISZdK3voUGhF2IkVib739H/IGoQwCsqYtLC8tJ72tPvg72TzZe4vC8CvgNfsFOy9qe1YHYwYiCyMBAcN5pzhkkh6POtdF2StULuDu8x9frI66dO6oLCQv2R79pwho7GSojIFloDkqBSGVHNkT88RzNfqbcaxljMjYZ1VEpYFkQ9/dHlcnGaZ2atvlPgU6zFbgiGZedrPbgYY7epLxUAyBUH+LcUXaH26wQIDAQAB";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  zip: { name: "bifocal" },
  vite: () => ({ plugins: [tailwindcss()] }),
  hooks: {
    "build:manifestGenerated": (_wxt, manifest) => {
      // Website checks register at runtime only after the user grants access.
      manifest.host_permissions = manifest.host_permissions?.filter((origin: string) => !pageOrigins.includes(origin));
    },
  },
  manifest: ({ mode }) => {
    const emulator = mode === "emulator";
    const judge = process.env.WXT_BIFOCAL_JUDGE_DEMO === "true";
    const clientId = emulator || judge ? undefined : process.env.WXT_GOOGLE_CLIENT_ID;
    const name = emulator ? "Bifocal (Emulator)"
      : mode === "spark-contact" && !judge ? "Bifocal (Trusted contacts)" : "Bifocal";
    return {
      name,
      description: "Spot warning signs in messages and pause before taking a risky action.",
      minimum_chrome_version: "139",
      permissions: ["sidePanel", "storage", "scripting", ...(clientId ? ["identity" as const] : [])],
      optional_host_permissions: pageOrigins,
      action: { default_title: `Open ${name}` },
      ...(emulator ? {
        host_permissions: ["http://127.0.0.1/*"],
        content_security_policy: {
          extension_pages: "script-src 'self'; object-src 'self'; connect-src http://127.0.0.1:9099 http://127.0.0.1:8080;",
        },
      } : { key: judge ? releaseKey : process.env.WXT_EXTENSION_KEY || releaseKey }),
      ...(clientId ? {
        oauth2: {
          client_id: clientId,
          scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        },
      } : {}),
    };
  },
});
