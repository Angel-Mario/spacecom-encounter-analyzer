import { readFileSync } from "node:fs";
import path from "node:path";

const desktopDirectory = path.resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(
  readFileSync(path.join(desktopDirectory, "package.json"), "utf-8")
).version;
const cargoManifest = readFileSync(
  path.join(desktopDirectory, "src-tauri", "Cargo.toml"),
  "utf-8"
);
const tauriConfig = JSON.parse(
  readFileSync(
    path.join(desktopDirectory, "src-tauri", "tauri.conf.json"),
    "utf-8"
  )
);
const cargoVersion = cargoManifest.match(/^version\s*=\s*"(?<version>[^"]+)"/mu)
  ?.groups?.version;
const tagVersion = process.env.GITHUB_REF_NAME?.replace(/^v/u, "");
const versions = {
  "Cargo manifest": cargoVersion,
  "Desktop package": packageVersion,
  "Git tag": tagVersion,
  "Tauri config": tauriConfig.version,
};

for (const [source, version] of Object.entries(versions)) {
  if (!version) {
    throw new Error(`Could not read the ${source} version.`);
  }

  if (version !== packageVersion) {
    throw new Error(
      `${source} version ${version} does not match desktop package version ${packageVersion}.`
    );
  }
}

console.log(`Release versions are synchronized: ${packageVersion}`);
