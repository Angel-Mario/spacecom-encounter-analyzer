import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const desktopDirectory = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(desktopDirectory, "../..");
const tauriDirectory = path.join(desktopDirectory, "src-tauri");
const resourcesDirectory = path.join(tauriDirectory, "resources");
const cliDirectory = path.join(resourcesDirectory, "cli");
const nodeExecutableName = process.platform === "win32" ? "node.exe" : "node";
const runtimeDirectory = path.join(resourcesDirectory, "runtime");

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  throw new Error(
    "Run this script through pnpm so the workspace CLI can be deployed."
  );
}
const pnpmCommand = pnpmCli.toLowerCase().endsWith(".exe")
  ? pnpmCli
  : process.execPath;
const pnpmArguments =
  pnpmCommand === pnpmCli
    ? [
        "--filter",
        "@spacecom-encounter-analyzer/cli",
        "deploy",
        "--prod",
        cliDirectory,
      ]
    : [
        pnpmCli,
        "--filter",
        "@spacecom-encounter-analyzer/cli",
        "deploy",
        "--prod",
        cliDirectory,
      ];

rmSync(cliDirectory, { force: true, recursive: true });
rmSync(runtimeDirectory, { force: true, recursive: true });
mkdirSync(resourcesDirectory, { recursive: true });
mkdirSync(runtimeDirectory, { recursive: true });

execFileSync(pnpmCommand, pnpmArguments, {
  cwd: repositoryRoot,
  stdio: "inherit",
});

copyFileSync(
  path.join(repositoryRoot, ".env.schema"),
  path.join(cliDirectory, ".env.schema")
);
const cliPackagePath = path.join(cliDirectory, "package.json");
const cliPackage = JSON.parse(readFileSync(cliPackagePath, "utf-8"));
delete cliPackage.dependencies["@spacecom-encounter-analyzer/engine"];
writeFileSync(cliPackagePath, `${JSON.stringify(cliPackage, null, 2)}\n`);
rmSync(
  path.join(cliDirectory, "node_modules", "@spacecom-encounter-analyzer"),
  { force: true, recursive: true }
);
copyFileSync(process.execPath, path.join(runtimeDirectory, nodeExecutableName));

const nodeDirectory = path.dirname(process.execPath);
const licenseCandidates = [
  path.join(nodeDirectory, "LICENSE"),
  path.join(nodeDirectory, "LICENSE.txt"),
  path.join(nodeDirectory, "THIRD_PARTY_NOTICES.md"),
  path.resolve(nodeDirectory, "..", "LICENSE"),
  path.resolve(nodeDirectory, "..", "LICENSE.txt"),
  path.resolve(nodeDirectory, "..", "THIRD_PARTY_NOTICES.md"),
  path.resolve(nodeDirectory, "..", "..", "LICENSE"),
  path.resolve(nodeDirectory, "..", "..", "LICENSE.txt"),
  path.resolve(nodeDirectory, "..", "..", "THIRD_PARTY_NOTICES.md"),
];
const nodeLicenses = licenseCandidates.filter((candidate) =>
  existsSync(candidate)
);

if (nodeLicenses.length === 0 && process.env.CI) {
  throw new Error(
    `Could not find Node.js license files near "${process.execPath}".`
  );
}

for (const nodeLicense of nodeLicenses) {
  copyFileSync(
    nodeLicense,
    path.join(runtimeDirectory, path.basename(nodeLicense))
  );
}

if (nodeLicenses.length === 0) {
  console.warn(
    "Could not find Node.js license files; they will be omitted from this local bundle."
  );
}

if (process.platform !== "win32") {
  chmodSync(path.join(runtimeDirectory, nodeExecutableName), 0o755);
}

console.log(
  `Prepared bundled CLI and Node.js runtime in ${resourcesDirectory}`
);
