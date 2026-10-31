import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Encounter } from "../../domain.js";

// Grava o array de encontros como JSON formatado no caminho informado,
// criando o diretório pai se ainda não existir.
// O arquivo termina com uma quebra de linha para conformidade com editores Unix.
export const writeJsonOutput = async (filePath: string, encounters: Encounter[]): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(encounters, null, 2)}\n`, "utf-8");
};
