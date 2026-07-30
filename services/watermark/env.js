// Central environment-variable reader. A stray leading/trailing space in a
// Railway/Supabase secret (a pasted key, a copied endpoint) must NEVER reach the
// code — trim once, here, everywhere. This module has no dependencies so it can
// be required at the top of any file without the load-time failure risk that a
// heavier module would carry.
//
// Returns `undefined` when the variable is unset (so `!env(name)` still detects a
// missing value) and the trimmed string otherwise.
function env(name) {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : undefined;
}

module.exports = { env };
