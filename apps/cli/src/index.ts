import packageJson from "../package.json" with { type: "json" };
import { runCommand } from "./commands.js";

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  if (args[0] === "--") {
    args.shift();
  }

  if (args.length === 0) {
    process.stdout.write(
      `Spacecom Encounter Analyzer CLI v${packageJson.version}\n\n`
    );
    await runCommand(["--help"]);
    return;
  }

  await runCommand(args);
};

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
