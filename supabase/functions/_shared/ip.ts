// Résout l'IP client réelle à partir de X-Forwarded-For.
//
// X-Forwarded-For est une chaîne "client, proxy1, proxy2, ...". Les premières
// entrées sont fournies par le client et donc falsifiables : un attaquant peut
// envoyer son propre en-tête pour faire varier la valeur à chaque requête et
// réinitialiser son quota de rate limit. La SEULE entrée digne de confiance est
// la DERNIÈRE, posée par l'edge Supabase (le hop directement en amont).
export function getClientIp(req: Request): string {
  const header = req.headers.get("x-forwarded-for");
  if (!header) return "unknown";
  const parts = header
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts[parts.length - 1] : "unknown";
}
