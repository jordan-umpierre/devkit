import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../dist/src/cli.js", import.meta.url));
const FIXTURE = fileURLToPath(
  new URL("./fixtures/sample.txt", import.meta.url),
);

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(args: string[], input = ""): Promise<Result> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [CLI, ...args],
      (err, stdout, stderr) => {
        resolve({
          code: (err as { code?: number } | null)?.code ?? 0,
          stdout,
          stderr,
        });
      },
    );
    child.stdin!.end(input);
  });
}

test("--version prints the package version", async () => {
  const r = await cli(["--version"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^\d+\.\d+\.\d+\n$/);
});

test("--help documents commands and exit codes", async () => {
  const r = await cli(["--help"]);
  assert.equal(r.code, 0);
  for (const word of ["calc", "stats", "convert", "Exit codes"]) {
    assert.ok(r.stdout.includes(word), `help missing "${word}"`);
  }
  assert.equal(r.stderr, "");
});

test("calc: result on stdout, exit 0", async () => {
  const r = await cli(["calc", "2+3*4"]);
  assert.deepEqual(r, { code: 0, stdout: "14\n", stderr: "" });
});

test("calc: multiple args joined as one expression", async () => {
  const r = await cli(["calc", "2", "+", "3"]);
  assert.deepEqual(r, { code: 0, stdout: "5\n", stderr: "" });
});

test("calc: stable JSON output", async () => {
  const r = await cli(["calc", "(1+2)*3", "--json"]);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '{"expression":"(1+2)*3","result":9}\n');
});

test("calc: malformed expression exits 1 with stderr only", async () => {
  const r = await cli(["calc", "2+"]);
  assert.equal(r.code, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /devkit: /);
});

test("calc: division by zero exits 1", async () => {
  const r = await cli(["calc", "1/0"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /division by zero/);
});

test("stats: file fixture, stable JSON", async () => {
  const r = await cli(["stats", FIXTURE, "--json"]);
  assert.equal(r.code, 0);
  const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed), [
    "bytes",
    "lines",
    "words",
    "chars",
    "topWords",
  ]);
  assert.equal(parsed["lines"], 3);
  assert.equal(parsed["words"], 16);
});

test("stats: reads stdin with -", async () => {
  const r = await cli(["stats", "-", "--json"], "hello hello world\n");
  assert.equal(r.code, 0);
  const parsed = JSON.parse(r.stdout) as {
    words: number;
    topWords: { word: string }[];
  };
  assert.equal(parsed.words, 3);
  assert.equal(parsed.topWords[0]!.word, "hello");
});

test("stats: missing file exits 1", async () => {
  const r = await cli(["stats", "definitely-missing.txt"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no such file/);
});

test("convert: text and JSON output", async () => {
  const text = await cli(["convert", "100", "c", "f"]);
  assert.deepEqual(text, { code: 0, stdout: "212\n", stderr: "" });
  const json = await cli(["convert", "1", "KM", "M", "--json"]);
  assert.equal(json.stdout, '{"value":1,"from":"km","to":"m","result":1000}\n');
});

test("convert: unknown unit exits 1", async () => {
  const r = await cli(["convert", "1", "m", "parsec"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /unknown unit/);
});

test("usage errors exit 2", async () => {
  for (const args of [
    [],
    ["frobnicate"],
    ["calc"],
    ["convert", "1", "m"],
    ["--bogus"],
  ]) {
    const r = await cli(args);
    assert.equal(r.code, 2, `expected exit 2 for: devkit ${args.join(" ")}`);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /devkit: /);
  }
});
