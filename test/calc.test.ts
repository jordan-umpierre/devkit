import { test } from "node:test";
import assert from "node:assert/strict";
import { calc } from "../src/calc.ts";
import { InputError } from "../src/errors.ts";

test("operator precedence and associativity", () => {
  assert.equal(calc("2+3*4"), 14);
  assert.equal(calc("2*3+4"), 10);
  assert.equal(calc("10-4-3"), 3); // left-associative
  assert.equal(calc("100/10/5"), 2);
  assert.equal(calc("2^3^2"), 512); // right-associative
  assert.equal(calc("10%4"), 2);
  assert.equal(calc("2+10%4"), 4);
});

test("parentheses", () => {
  assert.equal(calc("(2+3)*4"), 20);
  assert.equal(calc("((1+2)*(3+4))"), 21);
  assert.equal(calc("(5)"), 5);
});

test("unary signs", () => {
  assert.equal(calc("-5"), -5);
  assert.equal(calc("+5"), 5);
  assert.equal(calc("--5"), 5);
  assert.equal(calc("3--2"), 5);
  assert.equal(calc("-2^2"), -4); // ^ binds tighter than unary minus
  assert.equal(calc("(-2)^2"), 4);
  assert.equal(calc("2^-2"), 0.25);
  assert.equal(calc("-(2+3)"), -5);
});

test("decimals", () => {
  assert.equal(calc("1.5*2"), 3);
  assert.equal(calc(".5+.25"), 0.75);
  assert.equal(calc("0.1+0.2"), 0.1 + 0.2); // IEEE 754, deterministic
});

test("whitespace tolerated", () => {
  assert.equal(calc("  2 +\t3 "), 5);
});

test("malformed expressions rejected", () => {
  for (const bad of [
    "",
    "   ",
    "2+",
    "*3",
    "2 3",
    "(2+3",
    "2+3)",
    "1.2.3",
    "1.",
    ".",
    "2a",
    "()",
  ]) {
    assert.throws(
      () => calc(bad),
      InputError,
      `expected InputError for ${JSON.stringify(bad)}`,
    );
  }
});

test("division and modulo by zero rejected", () => {
  assert.throws(() => calc("1/0"), InputError);
  assert.throws(() => calc("5%0"), InputError);
  assert.throws(() => calc("1/(2-2)"), InputError);
});

test("non-finite results rejected", () => {
  assert.throws(() => calc("10^1000"), InputError); // overflow to Infinity
  assert.throws(() => calc("(0-1)^0.5"), InputError); // NaN
});
