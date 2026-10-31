import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

const NEWLINE_BYTE = 10;
const BOUNDARY_WINDOW_BYTES = 262_144;
const BOUNDARY_WINDOW_LIMIT = 16;

export interface DatasetChunk {
  end: number;
  start: number;
}

// Escaneia uma pequena janela em vez do arquivo inteiro: o corte é a
// primeira quebra de linha em ou após a posição alvo, seguida do byte
// seguinte (um começo de linha).
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
      // Linhas longíssimas fariam a varredura ler o arquivo inteiro; o
      // limite de janelas interrompe a busca e o chamador funde os chunks,
      // garantindo que todos os bytes continuem sendo processados.
      if (windows >= BOUNDARY_WINDOW_LIMIT) {
        return undefined;
      }
    }

    return undefined;
  } finally {
    input.destroy();
  }
};

// Divide o arquivo em no máximo `chunkCount` intervalos alinhados por
// linhas, para que cada worker leia uma faixa de bytes que começa exatamente
// onde o anterior parou.
export const planDatasetChunks = async (
  filePath: string,
  chunkCount: number,
): Promise<DatasetChunk[]> => {
  const { size } = await stat(filePath);

  const targets: number[] = [];
  for (let index = 1; index < chunkCount; index += 1) {
    targets.push(Math.round(size * (index / chunkCount)));
  }

  // As varreduras de corte leem janelas distintas do arquivo, então
  // executam em paralelo; a montagem crescente abaixo mantém a semântica
  // sequencial de descarte.
  const boundaries = await Promise.all(targets.map((target) => findLineBoundary(filePath, target)));

  const chunks: DatasetChunk[] = [];
  let start = 0;
  for (const boundary of boundaries) {
    // Cortes iguais ao início (nenhuma linha na janela) ou no fim do
    // arquivo (quebra final) são descartados para que cada chunk guarde ao
    // menos uma linha.
    if (boundary === undefined || boundary === size || boundary <= start) {
      continue;
    }

    chunks.push({ end: boundary, start });
    start = boundary;
  }

  chunks.push({ end: size, start });
  return chunks;
};
