import "varlock/auto-load";

import packageJson from "../package.json" with { type: "json" };
import { runCommand } from "./commands.js";

// Ponto de entrada da CLI: lê os argumentos do processo, exibe a versão e
// o texto de ajuda quando chamado sem argumentos, ou delega ao runCommand.
const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  if (args[0] === "--") {
    args.shift();
  }

  if (args.length === 0) {
    process.stdout.write(`Spacecom Encounter Analyzer CLI v${packageJson.version}\n\n`);
    await runCommand(["--help"]);
    return;
  }

  await runCommand(args);
};

// Erros não capturados são exibidos de forma amigável e encerram o processo com código 1.
try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
