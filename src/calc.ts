import { InputError } from "./errors.ts";

type Op = "+" | "-" | "*" | "/" | "%" | "^";

type Token =
  | { kind: "num"; value: number; text: string }
  | { kind: "op"; op: Op }
  | { kind: "lparen" }
  | { kind: "rparen" };

const OPS = "+-*/%^";

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }
    if (OPS.includes(ch)) {
      tokens.push({ kind: "op", op: ch as Op });
      i++;
      continue;
    }
    if (isDigit(ch) || ch === ".") {
      let j = i;
      let sawDigit = false;
      let sawDot = false;
      while (j < input.length && (isDigit(input[j]!) || input[j] === ".")) {
        if (input[j] === ".") {
          if (sawDot) {
            throw new InputError(
              `malformed number at position ${i + 1}: "${input.slice(i, j + 1)}"`,
            );
          }
          sawDot = true;
        } else {
          sawDigit = true;
        }
        j++;
      }
      const text = input.slice(i, j);
      if (!sawDigit || text.endsWith(".")) {
        throw new InputError(
          `malformed number at position ${i + 1}: "${text}"`,
        );
      }
      tokens.push({ kind: "num", value: Number(text), text });
      i = j;
      continue;
    }
    throw new InputError(`unexpected character "${ch}" at position ${i + 1}`);
  }
  return tokens;
}

function checkFinite(n: number): number {
  if (!Number.isFinite(n)) {
    throw new InputError("result is not a finite number");
  }
  return n;
}

/**
 * Recursive-descent grammar (highest binding last):
 *
 *   expr   := term  (("+" | "-") term)*
 *   term   := unary (("*" | "/" | "%") unary)*
 *   unary  := ("+" | "-") unary | power
 *   power  := atom ("^" unary)?          right-associative; -2^2 = -4, 2^-2 = 0.25
 *   atom   := number | "(" expr ")"
 */
class Parser {
  private readonly tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  done(): boolean {
    return this.pos >= this.tokens.length;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private nextOp(...ops: Op[]): Op | undefined {
    const t = this.peek();
    if (t?.kind === "op" && ops.includes(t.op)) {
      this.pos++;
      return t.op;
    }
    return undefined;
  }

  expr(): number {
    let value = this.term();
    for (let op = this.nextOp("+", "-"); op; op = this.nextOp("+", "-")) {
      const rhs = this.term();
      value = checkFinite(op === "+" ? value + rhs : value - rhs);
    }
    return value;
  }

  private term(): number {
    let value = this.unary();
    for (
      let op = this.nextOp("*", "/", "%");
      op;
      op = this.nextOp("*", "/", "%")
    ) {
      const rhs = this.unary();
      if ((op === "/" || op === "%") && rhs === 0) {
        throw new InputError(
          op === "/" ? "division by zero" : "modulo by zero",
        );
      }
      value = checkFinite(
        op === "*" ? value * rhs : op === "/" ? value / rhs : value % rhs,
      );
    }
    return value;
  }

  private unary(): number {
    const op = this.nextOp("+", "-");
    if (op) {
      const value = this.unary();
      return op === "-" ? -value : value;
    }
    return this.power();
  }

  private power(): number {
    const base = this.atom();
    if (this.nextOp("^")) {
      const exponent = this.unary();
      return checkFinite(base ** exponent);
    }
    return base;
  }

  private atom(): number {
    const t = this.peek();
    if (t === undefined) {
      throw new InputError("unexpected end of expression");
    }
    if (t.kind === "num") {
      this.pos++;
      return t.value;
    }
    if (t.kind === "lparen") {
      this.pos++;
      const value = this.expr();
      if (this.peek()?.kind !== "rparen") {
        throw new InputError("missing closing parenthesis");
      }
      this.pos++;
      return value;
    }
    const shown = t.kind === "op" ? t.op : ")";
    throw new InputError(`unexpected token "${shown}"`);
  }
}

/** Evaluate an arithmetic expression. Throws InputError on any malformed or non-finite input. */
export function calc(expression: string): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) {
    throw new InputError("empty expression");
  }
  const parser = new Parser(tokens);
  const value = parser.expr();
  if (!parser.done()) {
    throw new InputError("unexpected trailing tokens after expression");
  }
  return checkFinite(value);
}
