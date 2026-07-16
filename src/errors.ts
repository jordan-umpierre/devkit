/** Bad invocation: unknown command, wrong arity, unknown flag. Exit code 2. */
export class UsageError extends Error {}

/** Bad data: malformed expression, math error, unknown unit, unreadable file. Exit code 1. */
export class InputError extends Error {}
