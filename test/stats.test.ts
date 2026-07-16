import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats } from "../src/stats.ts";

async function* chunks(
  ...parts: (Buffer | string)[]
): AsyncIterable<Buffer | string> {
  yield* parts;
}

test("basic counts", async () => {
  const s = await computeStats(chunks("hello world\nhello again\n"));
  assert.equal(s.bytes, 24);
  assert.equal(s.lines, 2);
  assert.equal(s.words, 4);
  assert.equal(s.chars, 24);
  assert.deepEqual(s.topWords, [
    { word: "hello", count: 2 },
    { word: "again", count: 1 },
    { word: "world", count: 1 },
  ]);
});

test("empty input", async () => {
  const s = await computeStats(chunks());
  assert.deepEqual(s, { bytes: 0, lines: 0, words: 0, chars: 0, topWords: [] });
});

test("multi-byte character split across chunk boundary", async () => {
  const bytes = Buffer.from("héllo wörld", "utf8");
  // Split in the middle of the two-byte "é".
  const s = await computeStats(chunks(bytes.subarray(0, 2), bytes.subarray(2)));
  assert.equal(s.bytes, bytes.length);
  assert.equal(s.chars, 11);
  assert.equal(s.words, 2);
  assert.deepEqual(
    s.topWords.map((w) => w.word),
    ["héllo", "wörld"],
  );
});

test("word split across chunk boundary counts once", async () => {
  const s = await computeStats(chunks("hel", "lo world"));
  assert.equal(s.words, 2);
  assert.deepEqual(s.topWords, [
    { word: "hello", count: 1 },
    { word: "world", count: 1 },
  ]);
});

test("normalization: case-folded, punctuation-stripped", async () => {
  const s = await computeStats(chunks("Dog dog DOG, cat! cat; bird?"));
  assert.deepEqual(s.topWords, [
    { word: "dog", count: 3 },
    { word: "cat", count: 2 },
    { word: "bird", count: 1 },
  ]);
});

test("top words capped at five, ties broken alphabetically", async () => {
  const s = await computeStats(chunks("f e d c b a f e d c b a"));
  assert.deepEqual(s.topWords, [
    { word: "a", count: 2 },
    { word: "b", count: 2 },
    { word: "c", count: 2 },
    { word: "d", count: 2 },
    { word: "e", count: 2 },
  ]);
});

test("astral-plane characters count as single code points", async () => {
  const s = await computeStats(chunks("𝒳 𝒳"));
  assert.equal(s.chars, 3);
  assert.equal(s.words, 2);
});

test("no trailing newline still counts final word", async () => {
  const s = await computeStats(chunks("one two three"));
  assert.equal(s.lines, 0);
  assert.equal(s.words, 3);
  assert.equal(s.topWords.length, 3);
});
