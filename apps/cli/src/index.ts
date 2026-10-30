import packageJson from "../package.json" with { type: "json" };

async function main(): Promise<void> {
  process.stdout.write(`Spacecom Encounter Analyzer CLI v${packageJson.version}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
