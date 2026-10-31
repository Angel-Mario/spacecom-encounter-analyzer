import { createReadStream } from "node:fs";

const NEWLINE_BYTE = 10;
const STREAM_CHUNK_BYTES = 262_144;

export interface LineRange {
  highWaterMark?: number;
  // Offset em bytes; precisam cair em fronteira de linha, porque as linhas
  // são entregues completas: a leitura termina quando o offset final é
  // alcançado.
  end?: number;
  start?: number;
}

// A divisão manual de linhas evita a fila de promessas por linha da
// interface readline; os blocos em memória guardam apenas os bytes da linha
// parcial corrente. Quando `end` é informado, o leitor só entrega linhas
// cujo início fique estritamente antes de `end`.
export const readLines = async function* readLines(
  filePath: string,
  range: LineRange = {},
): AsyncGenerator<string> {
  const input = createReadStream(filePath, {
    end: range.end === undefined ? undefined : range.end - 1,
    highWaterMark: range.highWaterMark ?? STREAM_CHUNK_BYTES,
    start: range.start,
  });

  try {
    let pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);

    for await (const chunk of input) {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      pending = pending.length === 0 ? bufferChunk : Buffer.concat([pending, bufferChunk]);

      let newlineIndex = pending.indexOf(NEWLINE_BYTE);
      while (newlineIndex >= 0) {
        const line = pending.subarray(0, newlineIndex).toString("utf-8");
        pending = pending.subarray(newlineIndex + 1);
        newlineIndex = pending.indexOf(NEWLINE_BYTE);
        yield line.endsWith("\r") ? line.slice(0, -1) : line;
      }
    }

    if (pending.length > 0) {
      const line = pending.toString("utf-8");
      yield line.endsWith("\r") ? line.slice(0, -1) : line;
    }
  } finally {
    // O Node destrói o stream quando o gerador é encerrado antes do fim.
    input.destroy();
  }
};
