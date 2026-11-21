import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const directory = import.meta.dirname;
const dist = new URL("./dist/", import.meta.url);
await mkdir(dist, { recursive: true });

await build({
  absWorkingDir: directory,
  entryPoints: ["src/background.js", "src/offscreen.js", "src/panel.js"],
  outdir: fileURLToPath(dist),
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "chrome148",
});

for (const file of ["manifest.json", "offscreen.html", "panel.html"]) {
  await copyFile(new URL(file, import.meta.url), new URL(file, dist));
}
