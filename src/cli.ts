#!/usr/bin/env node
import { createReadStream, readFileSync } from "node:fs";
import process from "node:process";
import { calc } from "./calc.ts";
import { computeStats, type Stats } from "./stats.ts";
import { convert, UNITS } from "./convert.ts";
import { InputError, UsageError } from "./errors.ts";

const EXIT_OK = 0;
const EXIT_INPUT = 1; // bad data: malformed expression, math error, unknown unit, unreadable file
const EXIT_USAGE = 2; // bad invocation: unknown command, wrong arity, unknown flag

const HELP = `devkit — zero-dependency command-line toolkit

Usage:
  devkit calc <expression> [--json]
  devkit stats <file|-> [--json]
  devkit convert <value> <from> <to> [--json]
  devkit --help | --version

Commands:
  calc      Evaluate an arithmetic expression.
            Operators: + - * / % ^ (right-associative), unary +/-, parentheses,
            decimals. Division/modulo by zero and non-finite results fail.
  stats     Report bytes, lines (newlines), words, chars (code points), and the
            five most frequent normalized words. Pass "-" to read stdin.
            Input is streamed; arbitrarily large files are fine.
  convert   Convert between units of the same dimension (case-insensitive):
            length:      ${UNITS["length"]!.join(" ")}
            mass:        ${UNITS["mass"]!.join(" ")}
            temperature: ${UNITS["temperature"]!.join(" ")}

Options:
  --json         Print the result as stable JSON on one line.
  -h, --help     Show this help.
  -v, --version  Show the version.

Exit codes:
  0  success
  1  input error (malformed expression, math error, unknown unit, unreadable file)
  2  usage error (unknown command, wrong arguments, unknown flag)

Results go to stdout; errors go to stderr.`;

function version(): string {
  const pkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  return pkg.version;
}

function statsText(s: Stats): string {
  const top =
    s.topWords.length === 0
      ? "  (none)"
      : s.topWords
          .map((w, i) => `  ${i + 1}. ${w.word} (${w.count})`)
          .join("\n");
  return `bytes: ${s.bytes}\nlines: ${s.lines}\nwords: ${s.words}\nchars: ${s.chars}\ntop words:\n${top}`;
}

async function runStats(target: string): Promise<Stats> {
  if (target === "-") {
    return computeStats(process.stdin);
  }
  try {
    return await computeStats(createReadStream(target));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") throw new InputError(`no such file: ${target}`);
    if (e.code === "EISDIR") throw new InputError(`is a directory: ${target}`);
    if (e.code === "EACCES")
      throw new InputError(`permission denied: ${target}`);
    throw err;
  }
}

async function main(argv: string[]): Promise<number> {
  const positionals: string[] = [];
  let json = false;
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(HELP + "\n");
      return EXIT_OK;
    } else if (arg === "--version" || arg === "-v") {
      process.stdout.write(version() + "\n");
      return EXIT_OK;
    } else if (arg.startsWith("-") && arg !== "-") {
      throw new UsageError(`unknown option "${arg}"`);
    } else positionals.push(arg);
  }

  const [command, ...args] = positionals;
  switch (command) {
    case undefined:
      throw new UsageError("missing command");
    case "calc": {
      if (args.length === 0)
        throw new UsageError("calc requires an expression");
      const expression = args.join(" ");
      const result = calc(expression);
      process.stdout.write(
        json ? JSON.stringify({ expression, result }) + "\n" : result + "\n",
      );
      return EXIT_OK;
    }
    case "stats": {
      if (args.length !== 1)
        throw new UsageError("stats requires exactly one file argument (or -)");
      const stats = await runStats(args[0]!);
      process.stdout.write(
        json ? JSON.stringify(stats) + "\n" : statsText(stats) + "\n",
      );
      return EXIT_OK;
    }
    case "convert": {
      if (args.length !== 3)
        throw new UsageError("convert requires <value> <from> <to>");
      const value = Number(args[0]);
      if (args[0] === "" || Number.isNaN(value)) {
        throw new InputError(`value is not a number: "${args[0]}"`);
      }
      const [, from, to] = args as [string, string, string];
      const result = convert(value, from, to);
      process.stdout.write(
        json
          ? JSON.stringify({
              value,
              from: from.toLowerCase(),
              to: to.toLowerCase(),
              result,
            }) + "\n"
          : result + "\n",
      );
      return EXIT_OK;
    }
    default:
      throw new UsageError(`unknown command "${command}"`);
  }
}

// Downstream consumers closing the pipe (e.g. `devkit stats big.txt | head`) is normal Unix
// behavior, not an error.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(EXIT_OK);
  throw err;
});

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    if (err instanceof UsageError) {
      process.stderr.write(
        `devkit: ${err.message}\nrun "devkit --help" for usage\n`,
      );
      process.exitCode = EXIT_USAGE;
    } else if (err instanceof InputError) {
      process.stderr.write(`devkit: ${err.message}\n`);
      process.exitCode = EXIT_INPUT;
    } else {
      process.stderr.write(`devkit: unexpected error: ${String(err)}\n`);
      process.exitCode = EXIT_INPUT;
    }
  },
);
