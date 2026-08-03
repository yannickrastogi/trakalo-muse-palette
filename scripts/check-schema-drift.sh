#!/usr/bin/env bash
#
# check-schema-drift.sh
#
# Détecte la dérive entre les migrations appliquées en PRODUCTION
# (table supabase_migrations.schema_migrations) et les fichiers versionnés
# dans supabase/migrations/.
#
# LECTURE SEULE : uniquement des SELECT sur la table des migrations.
#   - version en prod SANS fichier local  -> DÉRIVE (exit 1)
#   - fichier local SANS version en prod   -> avertissement seulement (exit 0)
#   - pas de mot de passe                  -> SKIP propre (exit 0)
#   - erreur de connexion / psql absent    -> exit 2 (connexion) / SKIP (psql)
#
# Le mot de passe (PGPASSWORD) n'est JAMAIS affiché ni journalisé.
# Aucun secret en dur : la connexion se surcharge par l'environnement.
# Compatible bash 3.2 (macOS) : aucun tableau associatif.
#
set -euo pipefail

# --- Connexion (valeurs par défaut non secrètes, surchargeables) -------------
export PGHOST="${PGHOST:-aws-1-us-east-1.pooler.supabase.com}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres.xhmeitivkclbeziqavxw}"
export PGDATABASE="${PGDATABASE:-postgres}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

# --- Garde-fou : pas de mot de passe -> SKIP (jamais une erreur psql) --------
if [ -z "${PGPASSWORD:-}" ]; then
  echo "SKIP : variable PGPASSWORD absente."
  echo "       Définis-la (secret SUPABASE_DB_PASSWORD) pour vérifier la dérive."
  echo "       Aucune vérification effectuée."
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP : client psql introuvable. Installe le client postgresql."
  exit 0
fi

work_dir="$(mktemp -d)"
trap 'rm -f "$work_dir"/* 2>/dev/null; rmdir "$work_dir" 2>/dev/null' EXIT

remote_rows="$work_dir/remote_rows"      # version|name
remote_versions="$work_dir/remote_versions"
local_versions="$work_dir/local_versions"
err_file="$work_dir/psql_err"

# --- Lecture des versions distantes (SELECT en lecture seule) -----------------
if ! psql -X -A -t -F '|' -v ON_ERROR_STOP=1 \
    -c "SELECT version, coalesce(name, '') FROM supabase_migrations.schema_migrations ORDER BY version;" \
    > "$remote_rows" 2>"$err_file"; then
  echo "ERREUR : impossible de lire les migrations distantes."
  # La sortie d'erreur psql ne contient pas le mot de passe.
  sed 's/^/  psql: /' "$err_file" >&2 || true
  exit 2
fi

# versions distantes triées et uniques (lignes vides écartées)
cut -d'|' -f1 "$remote_rows" | grep -E '.' | sort -u > "$remote_versions"

# --- Versions locales : préfixe 14 chiffres, hors _archive/ -------------------
: > "$local_versions"
shopt -s nullglob
for f in "$MIGRATIONS_DIR"/*.sql; do
  base="$(basename "$f")"
  if [[ "$base" =~ ^([0-9]{14})_ ]]; then
    echo "${BASH_REMATCH[1]}" >> "$local_versions"
  fi
done
shopt -u nullglob
sort -u -o "$local_versions" "$local_versions"

remote_total="$(grep -cE '.' "$remote_versions" || true)"
local_total="$(grep -cE '.' "$local_versions" || true)"

# --- Comparaison via comm (portable) -----------------------------------------
# -23 : présent en prod, absent en local -> DÉRIVE
# -13 : présent en local, absent en prod -> avance légitime
drift_list="$(comm -23 "$remote_versions" "$local_versions")"
ahead_list="$(comm -13 "$remote_versions" "$local_versions")"

# --- Rapport ------------------------------------------------------------------
echo "== Vérification de la dérive de schéma =="
echo "  Migrations en production : $remote_total"
echo "  Fichiers locaux (14 chiffres) : $local_total"
echo

if [ -n "$ahead_list" ]; then
  ahead_count="$(printf '%s\n' "$ahead_list" | grep -cE '.' || true)"
  echo "AVERTISSEMENT : ${ahead_count} fichier(s) local(aux) pas encore appliqué(s) en prod (cas légitime) :"
  printf '%s\n' "$ahead_list" | while IFS= read -r v; do
    [ -n "$v" ] && echo "  - $v"
  done
  echo
fi

if [ -n "$drift_list" ]; then
  drift_count="$(printf '%s\n' "$drift_list" | grep -cE '.' || true)"
  echo "DÉRIVE : ${drift_count} migration(s) appliquée(s) en prod SANS fichier local :"
  printf '%s\n' "$drift_list" | while IFS= read -r v; do
    [ -z "$v" ] && continue
    name="$(grep -E "^${v}\|" "$remote_rows" | head -n1 | cut -d'|' -f2-)"
    if [ -n "$name" ]; then
      echo "  - $v  ($name)"
    else
      echo "  - $v"
    fi
  done
  echo
  echo "Résultat : DÉRIVE détectée. Exécute scripts/extract-missing-migrations.sh pour récupérer le SQL."
  exit 1
fi

echo "Résultat : aucune dérive. Le repo est aligné sur la production."
exit 0
