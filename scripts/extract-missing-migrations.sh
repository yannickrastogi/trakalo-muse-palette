#!/usr/bin/env bash
#
# extract-missing-migrations.sh
#
# Pour chaque version appliquée en PRODUCTION mais absente de
# supabase/migrations/, extrait le SQL depuis la production et écrit
# le fichier de migration versionné correspondant.
#
# LECTURE SEULE sur la production (uniquement des SELECT).
#   - ne réécrit JAMAIS un fichier existant
#   - refuse d'écrire un fichier vide (une extraction ratée ne doit pas
#     produire un fichier de 0 octet qui masquerait la dérive)
#   - le mot de passe (PGPASSWORD) n'est JAMAIS affiché ni journalisé
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

if [ -z "${PGPASSWORD:-}" ]; then
  echo "SKIP : variable PGPASSWORD absente. Aucune extraction effectuée."
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP : client psql introuvable. Installe le client postgresql."
  exit 0
fi

work_dir="$(mktemp -d)"
trap 'rm -f "$work_dir"/* 2>/dev/null; rmdir "$work_dir" 2>/dev/null' EXIT

remote_rows="$work_dir/remote_rows"
remote_versions="$work_dir/remote_versions"
local_versions="$work_dir/local_versions"
err_file="$work_dir/psql_err"

# --- Versions distantes (version|name) ---------------------------------------
if ! psql -X -A -t -F '|' -v ON_ERROR_STOP=1 \
    -c "SELECT version, coalesce(name, '') FROM supabase_migrations.schema_migrations ORDER BY version;" \
    > "$remote_rows" 2>"$err_file"; then
  echo "ERREUR : impossible de lire les migrations distantes."
  sed 's/^/  psql: /' "$err_file" >&2 || true
  exit 2
fi
cut -d'|' -f1 "$remote_rows" | grep -E '.' | sort -u > "$remote_versions"

# --- Versions locales déjà présentes (préfixe 14 chiffres, hors _archive/) ----
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

# --- Baseline : ne jamais extraire une migration antérieure à la baseline -----
# La baseline (*_baseline_prod.sql) contient déjà le résultat des migrations
# antérieures (archivées dans _archive/). Extraire une version <= baseline
# dupliquerait des fichiers déjà présents. On détecte la version de la baseline
# dynamiquement et on ne considère que les versions STRICTEMENT SUPÉRIEURES.
baseline_version=""
shopt -s nullglob
for f in "$MIGRATIONS_DIR"/*baseline_prod*.sql; do
  bname="$(basename "$f")"
  if [[ "$bname" =~ ^([0-9]{14})_ ]]; then
    baseline_version="${BASH_REMATCH[1]}"
    break
  fi
done
shopt -u nullglob

remote_compared="$work_dir/remote_compared"
if [ -n "$baseline_version" ]; then
  awk -v b="$baseline_version" \
    '$0 ~ /^[0-9]+$/ && length($0)==14 && ($0+0) > (b+0)' \
    "$remote_versions" > "$remote_compared"
else
  echo "AVERTISSEMENT : aucun fichier *_baseline_prod.sql trouvé — extraction sans filtre baseline."
  cp "$remote_versions" "$remote_compared"
fi

# --- Ensemble « connu » = fichiers versionnés OÙ QU'ILS SOIENT ----------------
# Une migration déjà versionnée n'importe où (fichier actif OU archivé dans
# _archive/, récursif) ne doit JAMAIS être extraite : elle dupliquerait un
# fichier existant. Le n° de version de la baseline n'est pas un seuil fiable ;
# le signal fiable est l'existence d'un fichier. LECTURE SEULE : on ne lit que
# des noms de fichiers, on ne modifie jamais _archive/.
archive_versions="$work_dir/archive_versions"
: > "$archive_versions"
if [ -d "$MIGRATIONS_DIR/_archive" ]; then
  find "$MIGRATIONS_DIR/_archive" -type f -name '*.sql' | while IFS= read -r af; do
    abase="$(basename "$af")"
    if [[ "$abase" =~ ^([0-9]{14})_ ]]; then
      echo "${BASH_REMATCH[1]}"
    fi
  done >> "$archive_versions"
fi
sort -u -o "$archive_versions" "$archive_versions"

known_versions="$work_dir/known_versions"
cat "$local_versions" "$archive_versions" | grep -E '.' | sort -u > "$known_versions"

# --- Versions manquantes = en prod (> baseline), SANS aucun fichier connu -----
missing="$(comm -23 "$remote_compared" "$known_versions")"

created=0
skipped=0

# here-string (pas de pipe) pour que created/skipped ne soient pas perdus
# dans un sous-shell.
while IFS= read -r version; do
  [ -z "$version" ] && continue

  # garde-fou anti-injection : la version doit être 14 chiffres
  if ! printf '%s' "$version" | grep -qE '^[0-9]{14}$'; then
    echo "IGNORÉ : version au format inattendu '$version'."
    continue
  fi

  # nom associé en prod
  name="$(grep -E "^${version}\|" "$remote_rows" | head -n1 | cut -d'|' -f2-)"

  # nom de fichier assaini : alphanumérique, tirets, underscores ; tronqué à 60
  sanitized="$(printf '%s' "$name" | LC_ALL=C tr -cs 'a-zA-Z0-9_-' '_')"
  sanitized="${sanitized#_}"
  sanitized="${sanitized%_}"
  [ -z "$sanitized" ] && sanitized="migration"
  sanitized="$(printf '%s' "$sanitized" | cut -c1-60)"

  out="$MIGRATIONS_DIR/${version}_${sanitized}.sql"

  # ne JAMAIS réécrire un fichier existant
  if [ -e "$out" ]; then
    echo "SKIP : $(basename "$out") existe déjà, non réécrit."
    skipped=$((skipped + 1))
    continue
  fi

  # extraction du SQL depuis la production
  if ! sql="$(psql -X -A -t -v ON_ERROR_STOP=1 \
      -c "SELECT array_to_string(statements, E';\n\n') || ';' FROM supabase_migrations.schema_migrations WHERE version = '$version';" \
      2>"$err_file")"; then
    echo "ERREUR : extraction impossible pour $version."
    sed 's/^/  psql: /' "$err_file" >&2 || true
    exit 2
  fi

  # refuse un contenu vide (extraction ratée) — ; seul ou espaces = vide
  stripped="$(printf '%s' "$sql" | tr -d '[:space:];')"
  if [ -z "$stripped" ]; then
    echo "REFUS : SQL vide extrait pour $version — fichier non écrit."
    skipped=$((skipped + 1))
    continue
  fi

  printf '%s\n' "$sql" > "$out"
  echo "CRÉÉ : $(basename "$out")"
  created=$((created + 1))
done <<< "$missing"

echo
echo "== Extraction terminée : $created fichier(s) créé(s), $skipped ignoré(s). =="
exit 0
