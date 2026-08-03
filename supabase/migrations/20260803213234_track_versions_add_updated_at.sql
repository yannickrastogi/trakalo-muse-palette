-- track_versions était la seule table sans updated_at : impossible de savoir quand une
-- version avait été renommée, réactivée ou son fichier remplacé.
ALTER TABLE track_versions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Initialisation cohérente sur les lignes existantes.
UPDATE track_versions SET updated_at = coalesce(created_at, now());

-- Réutilise le trigger générique existant s'il est présent, sinon en crée un dédié.
DO $setup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'set_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_track_versions_updated_at ON track_versions';
    EXECUTE 'CREATE TRIGGER trg_track_versions_updated_at
             BEFORE UPDATE ON track_versions
             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  ELSE
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.touch_track_versions_updated_at()
      RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $body$
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END;
      $body$;
    $fn$;
    EXECUTE 'DROP TRIGGER IF EXISTS trg_track_versions_updated_at ON track_versions';
    EXECUTE 'CREATE TRIGGER trg_track_versions_updated_at
             BEFORE UPDATE ON track_versions
             FOR EACH ROW EXECUTE FUNCTION public.touch_track_versions_updated_at()';
  END IF;
END
$setup$;;
