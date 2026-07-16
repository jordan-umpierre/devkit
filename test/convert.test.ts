import { test } from "node:test";
import assert from "node:assert/strict";
import { convert } from "../src/convert.ts";
import { InputError } from "../src/errors.ts";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !~ ${expected}`);

test("length conversions", () => {
  assert.equal(convert(1, "km", "m"), 1000);
  close(convert(12, "in", "ft"), 1);
  close(convert(1, "mi", "km"), 1.609344);
  close(convert(1, "yd", "ft"), 3);
  assert.equal(convert(10, "mm", "cm"), 1);
});

test("mass conversions", () => {
  assert.equal(convert(1000, "g", "kg"), 1);
  close(convert(1, "lb", "oz"), 16);
  close(convert(1, "lb", "kg"), 0.45359237);
  assert.equal(convert(1e6, "mg", "kg"), 1);
});

test("temperature affine formulas", () => {
  assert.equal(convert(100, "c", "f"), 212);
  assert.equal(convert(32, "f", "c"), 0);
  assert.equal(convert(0, "c", "k"), 273.15);
  close(convert(-40, "f", "c"), -40);
});

test("temperature round trips", () => {
  for (const v of [-273.15, -40, 0, 37, 100, 451]) {
    close(convert(convert(v, "c", "f"), "f", "c"), v);
    close(convert(convert(v, "c", "k"), "k", "c"), v);
  }
});

test("unit names are case-insensitive", () => {
  assert.equal(convert(1, "KM", "M"), 1000);
  assert.equal(convert(100, "C", "F"), 212);
});

test("identity conversion", () => {
  assert.equal(convert(42, "m", "m"), 42);
});

test("unknown units rejected", () => {
  assert.throws(() => convert(1, "furlong", "m"), InputError);
  assert.throws(() => convert(1, "m", "parsec"), InputError);
});

test("dimension mismatch rejected", () => {
  assert.throws(() => convert(1, "kg", "m"), InputError);
  assert.throws(() => convert(1, "c", "kg"), InputError);
});

test("non-finite value rejected", () => {
  assert.throws(() => convert(Number.POSITIVE_INFINITY, "m", "km"), InputError);
  assert.throws(() => convert(Number.NaN, "m", "km"), InputError);
});
