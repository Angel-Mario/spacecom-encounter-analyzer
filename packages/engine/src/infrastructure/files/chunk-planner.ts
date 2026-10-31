import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

const NEWLINE_BYTE = 10;
const BOUNDARY_WINDOW_BYTES = 262_144;
const BOUNDARY_WINDOW_LIMIT = 16;

export interface DatasetChunk {
  end: number;
  start: number;
}

// Localiza a primeira quebra de linha a partir de `target`, retornando o offset
// do byte imediatamente seguinte (início da próxima linha).
// Escaneia uma pequena janela em vez do arquivo inteiro; se nenhuma quebra de linha
// for encontrada dentro do limite de janelas, retorna undefined e o chamador
// une os chunks afetados para garantir que nenhum byte fique sem processar.
const findLineBoundary = async (filePath: string, target: number): Promise<number | undefined> => {
  const input = createReadStream(filePath, {
    highWaterMark: BOUNDARY_WINDOW_BYTES,
    start: target,
  });

  try {
    let pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let offset = target;
    let windows = 0;

    for await (const chunk of input) {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      pending = pending.length === 0 ? bufferChunk : Buffer.concat([pending, bufferChunk]);

      const newlineIndex = pending.indexOf(NEWLINE_BYTE);
      if (newlineIndex !== -1) {
        return offset + newlineIndex + 1;
      }

      offset += pending.length;
      pending = Buffer.alloc(0);
      windows += 1;
      // Linhas muito longas fariam a varredura ler o arquivo inteiro; o limite de janelas
      // interrompe a busca e faz o chamador unir os chunks, garantindo que todos os bytes
      // continuem sendo processados.
      if (windows >= BOUNDARY_WINDOW_LIMIT) {
        return undefined;
      }
    }

    return undefined;
  } finally {
    input.destroy();
  }
};

// Divide o arquivo em no máximo `chunkCount` intervalos alinhados por linha,
// para que cada worker leia uma faixa de bytes que começa exatamente onde o anterior parou.
// As varreduras de fronteira são feitas em paralelo (Promise.all) e depois ordenadas.
// Cortes inválidos (undefined, além do fim ou menores que o início) são descartados,
// podendo resultar em menos chunks do que o solicitado.
export const planDatasetChunks = async (
  filePath: string,
  chunkCount: number,
): Promise<DatasetChunk[]> => {
  const { size } = await stat(filePath);

  const targets: number[] = [];
  for (let index = 1; index < chunkCount; index += 1) {
    targets.push(Math.round(size * (index / chunkCount)));
  }

  // As varreduras de corte leem janelas distintas do arquivo, portanto executam em paralelo.
  const boundaries = await Promise.all(targets.map((target) => findLineBoundary(filePath, target)));

  const chunks: DatasetChunk[] = [];
  let start = 0;
  for (const boundary of boundaries) {
    // Cortes iguais ao início (nenhuma linha na janela) ou no fim do arquivo
    // são descartados para que cada chunk guarde ao menos uma linha.
    if (boundary === undefined || boundary === size || boundary <= start) {
      continue;
    }

    chunks.push({ end: boundary, start });
    start = boundary;
  }

  chunks.push({ end: size, start });
  return chunks;
};
