export function checkEditPassword(password: unknown): boolean {
  const expected = process.env.EDIT_PASSWORD;
  if (!expected) {
    // Without a password configured, allow edits (local/dev convenience).
    return true;
  }
  return typeof password === "string" && password === expected;
}
