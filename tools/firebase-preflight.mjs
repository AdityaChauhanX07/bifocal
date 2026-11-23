import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";

const repo = resolve(import.meta.dirname, "..");
const project = JSON.parse(readFileSync(join(repo, ".firebaserc"), "utf8")).projects.hackathon;
const configFields = ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID"];
const releaseFiles = [".env", ".env.local", ".env.production", ".env.production.local"];

function readEnv(directory, files) {
  return Object.assign({}, ...files.map((name) => join(repo, directory, name))
    .filter(existsSync)
    .map((file) => parseEnv(readFileSync(file, "utf8"))));
}

function missing(env, fields) {
  return fields.filter((name) => !env[name]?.trim());
}

function projectIssues(env, prefix) {
  const field = prefix + "PROJECT_ID";
  return env[field] && env[field] !== project ? [`${field} doesn’t match the hackathon project`] : [];
}

function report(label, issues) {
  console.log(`${label} · ${issues.length ? issues.join(", ") : "local configuration ready"}`);
  return issues.length === 0;
}

function validHttps(env, key) {
  if (!env[key]) return [`set ${key}`];
  return URL.parse(env[key])?.protocol === "https:" ? [] : [`${key} must use HTTPS`];
}

const web = { ...readEnv("apps/web", releaseFiles), ...process.env };
const extension = {
  ...readEnv("apps/extension", [...releaseFiles, ".env.chrome", ".env.chrome.local", ".env.production.chrome", ".env.production.chrome.local"]),
  ...process.env,
};
const functionFiles = [`.env.${project}`, ".env.hackathon"];
const functions = readEnv("functions", [".env", ...functionFiles]);
const duplicateFunctionFiles = functionFiles.every((file) => existsSync(join(repo, "functions", file)));
const manifestPath = join(repo, "apps/extension/.output/chrome-mv3/manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : undefined;
const extensionOrigin = manifest?.key && "chrome-extension://" + createHash("sha256")
  .update(Buffer.from(manifest.key, "base64")).digest("hex").slice(0, 32)
  .replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + parseInt(digit, 16)));

console.log(`Firebase project ${project}`);
if (extensionOrigin) console.log(`Chrome release origin ${extensionOrigin}`);
console.log("Missing settings are listed by name.");

const dashboardReady = report("Dashboard", [
  ...missing(web, configFields.map((key) => `VITE_FIREBASE_${key}`)),
  ...projectIssues(web, "VITE_FIREBASE_"),
]);
const webCloudReady = report("Web cloud samples and evaluation", [
  ...(!dashboardReady ? ["configure the dashboard"] : []),
  ...missing(web, ["VITE_FIREBASE_APP_CHECK_SITE_KEY"]),
]);
report("Web pasted-text cloud option", [
  ...(!webCloudReady ? ["configure web cloud checks"] : []),
  ...(web.VITE_BIFOCAL_ENABLE_PASTED_CLOUD !== "true" ? ["VITE_BIFOCAL_ENABLE_PASTED_CLOUD is disabled"] : []),
]);
const extensionReady = report("Chrome sign-in", [
  ...missing(extension, [...configFields.map((key) => `WXT_FIREBASE_${key}`), "WXT_GOOGLE_CLIENT_ID"]),
  ...projectIssues(extension, "WXT_FIREBASE_"),
  ...(!extensionOrigin ? ["build the Chrome release ZIP"] : []),
  ...(extension.WXT_GOOGLE_CLIENT_ID && manifest?.oauth2?.client_id !== extension.WXT_GOOGLE_CLIENT_ID
    ? ["rebuild the extension with the configured OAuth client"] : []),
  ...(extension.WXT_EXTENSION_KEY && manifest?.key !== extension.WXT_EXTENSION_KEY
    ? ["rebuild the extension with the configured public key"] : []),
]);
const functionsIssues = duplicateFunctionFiles ? ["use one project-specific Functions env file"] : [];
const extensionCloudReady = report("Chrome cloud checks", [
  ...(!extensionReady ? ["configure Chrome sign-in"] : []),
  ...validHttps(extension, "WXT_APP_CHECK_URL"),
  ...functionsIssues,
  ...missing(functions, ["BIFOCAL_EXTENSION_ORIGIN", "BIFOCAL_EXTENSION_APP_ID"]),
  ...(functions.BIFOCAL_EXTENSION_ORIGIN && extensionOrigin && functions.BIFOCAL_EXTENSION_ORIGIN !== extensionOrigin
    ? ["BIFOCAL_EXTENSION_ORIGIN doesn’t match the Chrome build"] : []),
  ...(functions.BIFOCAL_EXTENSION_APP_ID && extension.WXT_FIREBASE_APP_ID &&
    functions.BIFOCAL_EXTENSION_APP_ID !== extension.WXT_FIREBASE_APP_ID
    ? ["BIFOCAL_EXTENSION_APP_ID doesn’t match the extension app"] : []),
]);
report("Chrome consented cloud option", [
  ...(!extensionCloudReady ? ["configure Chrome cloud checks"] : []),
  ...(extension.WXT_ENABLE_APPROVED_CLOUD !== "true" ? ["WXT_ENABLE_APPROVED_CLOUD is disabled"] : []),
]);
report("Phone push", [
  ...(!dashboardReady ? ["configure the dashboard"] : []),
  ...missing(web, ["VITE_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_VAPID_KEY"]),
  ...functionsIssues,
  ...validHttps(functions, "BIFOCAL_DASHBOARD_URL"),
]);

console.log("Run the live checks separately for Google sign-in, App Check, Function deployment, and phone delivery.");
