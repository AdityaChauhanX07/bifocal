import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const extension = import.meta.dirname;
const repo = resolve(extension, "../..");
const [command, ...flags] = process.argv.slice(2);
const npmCli = process.env.npm_execpath;

function npm(args, cwd) {
  const { error, status } = spawnSync(process.execPath, [npmCli, ...args], { cwd, stdio: "inherit" });
  if (error) throw error;
  if (status !== 0) throw new Error(`npm ${args[0]} failed with exit code ${status}`);
}

function build(directory) {
  npm(["exec", "--offline", "--", "wxt", command, ...flags], directory);
}

if (!npmCli || !["build", "zip"].includes(command)) {
  throw new Error("Use npm run build or npm run zip for @bifocal/extension.");
}

if (!repo.includes("#")) {
  build(extension);
} else {
  // Vite treats # in a WXT entry point's path as a URL fragment.
  const tempRoot = await realpath(tmpdir());
  const stage = await mkdtemp(join(tempRoot, "bifocal-chrome-"));
  const generated = new Set(["node_modules", "dist", ".wxt", ".output"]);
  try {
    const sources = ["package.json", "package-lock.json", "apps/extension", "apps/web/package.json", "packages/core"];
    for (const file of sources) {
      const destination = join(stage, file);
      await mkdir(dirname(destination), { recursive: true });
      await cp(join(repo, file), destination, {
        recursive: true,
        filter: (source) => !generated.has(basename(source)),
      });
    }

    npm(["ci", "-w", "@bifocal/extension", "-w", "@bifocal/core", "--prefer-offline", "--no-audit", "--no-fund"], stage);
    const stagedExtension = join(stage, "apps/extension");
    build(stagedExtension);
    const output = join(extension, ".output");
    await cp(join(stagedExtension, ".output"), output, { recursive: true });
    process.stdout.write(`Chrome build copied to ${output}\n`);
  } finally {
    if (dirname(await realpath(stage)) === tempRoot) await rm(stage, { recursive: true, force: true, maxRetries: 3 });
  }
}
