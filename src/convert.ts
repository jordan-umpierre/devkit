import { InputError } from "./errors.ts";

// Linear dimensions: factor converts the unit to the base unit (m, kg).
const LENGTH_TO_M: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

const MASS_TO_KG: Record<string, number> = {
  mg: 1e-6,
  g: 0.001,
  kg: 1,
  oz: 0.028349523125,
  lb: 0.45359237,
};

// Temperature is affine, not linear: explicit to/from Kelvin formulas.
const TEMP: Record<
  string,
  { toK: (v: number) => number; fromK: (k: number) => number }
> = {
  c: { toK: (v) => v + 273.15, fromK: (k) => k - 273.15 },
  f: {
    toK: (v) => (v - 32) * (5 / 9) + 273.15,
    fromK: (k) => (k - 273.15) * (9 / 5) + 32,
  },
  k: { toK: (v) => v, fromK: (k) => k },
};

export const UNITS: Record<string, string[]> = {
  length: Object.keys(LENGTH_TO_M),
  mass: Object.keys(MASS_TO_KG),
  temperature: Object.keys(TEMP),
};

function dimensionOf(unit: string): string | undefined {
  if (unit in LENGTH_TO_M) return "length";
  if (unit in MASS_TO_KG) return "mass";
  if (unit in TEMP) return "temperature";
  return undefined;
}

/** Convert value between two units of the same dimension. Unit names are case-insensitive. */
export function convert(value: number, from: string, to: string): number {
  if (!Number.isFinite(value)) {
    throw new InputError("value must be a finite number");
  }
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  const fDim = dimensionOf(f);
  const tDim = dimensionOf(t);
  if (fDim === undefined) {
    throw new InputError(
      `unknown unit "${from}" (run "devkit --help" for supported units)`,
    );
  }
  if (tDim === undefined) {
    throw new InputError(
      `unknown unit "${to}" (run "devkit --help" for supported units)`,
    );
  }
  if (fDim !== tDim) {
    throw new InputError(
      `cannot convert ${fDim} ("${from}") to ${tDim} ("${to}")`,
    );
  }
  let result: number;
  if (fDim === "temperature") {
    result = TEMP[t]!.fromK(TEMP[f]!.toK(value));
  } else {
    const factors = fDim === "length" ? LENGTH_TO_M : MASS_TO_KG;
    result = (value * factors[f]!) / factors[t]!;
  }
  if (!Number.isFinite(result)) {
    throw new InputError("result is not a finite number");
  }
  return result;
}
