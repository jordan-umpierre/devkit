export interface WordCount {
  word: string;
  count: number;
}

export interface Stats {
  bytes: number;
  lines: number;
  words: number;
  chars: number;
  topWords: WordCount[];
}

const WORD_CHAR = /[\p{L}\p{N}]/u;
const SPACE = /\s/u;

/**
 * Compute text statistics from a stream of chunks without buffering the input.
 *
 * - bytes: total input bytes
 * - lines: newline count (wc-style)
 * - words: whitespace-separated tokens (wc-style)
 * - chars: Unicode code points
 * - topWords: five most frequent normalized words (lowercased runs of
 *   letters/digits), ties broken alphabetically for deterministic output
 *
 * Multi-byte UTF-8 sequences split across chunk boundaries are handled by
 * the streaming TextDecoder.
 */
export async function computeStats(
  source: AsyncIterable<Buffer | string>,
): Promise<Stats> {
  const decoder = new TextDecoder("utf-8");
  let bytes = 0;
  let lines = 0;
  let words = 0;
  let chars = 0;
  let inToken = false;
  let currentWord = "";
  const counts = new Map<string, number>();

  const flushWord = (): void => {
    if (currentWord !== "") {
      const w = currentWord.toLowerCase();
      counts.set(w, (counts.get(w) ?? 0) + 1);
      currentWord = "";
    }
  };

  const consume = (text: string): void => {
    for (const ch of text) {
      chars++;
      if (ch === "\n") lines++;
      if (SPACE.test(ch)) {
        inToken = false;
      } else if (!inToken) {
        inToken = true;
        words++;
      }
      if (WORD_CHAR.test(ch)) {
        currentWord += ch;
      } else {
        flushWord();
      }
    }
  };

  for await (const chunk of source) {
    if (typeof chunk === "string") {
      bytes += Buffer.byteLength(chunk);
      consume(chunk);
    } else {
      bytes += chunk.length;
      consume(decoder.decode(chunk, { stream: true }));
    }
  }
  consume(decoder.decode());
  flushWord();

  const topWords = [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : 1))
    .slice(0, 5);

  return { bytes, lines, words, chars, topWords };
}
