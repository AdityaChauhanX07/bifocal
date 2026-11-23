import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const npm = process.env.npm_execpath;
const sparkSamples = process.argv.includes("--spark-samples");
if (!npm) throw new Error("Run npm run build:judge-demo.");

function build(workspace, script, settings) {
  const run = spawnSync(process.execPath, [npm, "run", script, "-w", workspace], {
    cwd: repo,
    env: { ...process.env, ...settings },
    stdio: "inherit",
  });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`${workspace} ${script} failed.`);
}

build("@bifocal/extension", "zip", {
  WXT_BIFOCAL_JUDGE_DEMO: "true",
});
build("@bifocal/web", "build", {
  VITE_BIFOCAL_JUDGE_DEMO: "true",
  ...(!sparkSamples && {
    VITE_FIREBASE_API_KEY: "",
    VITE_FIREBASE_AUTH_DOMAIN: "",
    VITE_FIREBASE_PROJECT_ID: "",
    VITE_FIREBASE_APP_ID: "",
    VITE_FIREBASE_APP_CHECK_SITE_KEY: "",
  }),
  VITE_FIREBASE_MESSAGING_SENDER_ID: "",
  VITE_FIREBASE_VAPID_KEY: "",
  VITE_BIFOCAL_ENABLE_PASTED_CLOUD: "false",
});

const extension = join(repo, "apps/extension/.output");
const manifest = JSON.parse(await readFile(join(extension, "chrome-mv3/manifest.json"), "utf8"));
if (manifest.oauth2 || manifest.permissions.includes("identity")) throw new Error("Expected a local-only Chrome build.");

const downloads = join(repo, "apps/web/dist/downloads");
await mkdir(downloads, { recursive: true });
await copyFile(join(extension, `bifocal-${manifest.version}-chrome.zip`), join(downloads, "bifocal-chrome.zip"));
