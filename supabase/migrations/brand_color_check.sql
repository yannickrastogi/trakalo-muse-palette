-- ═══════════════════════════════════════════════════════════════════════
-- TRAKALOG — Brand color format constraint (defense-in-depth)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Date         : 2026-05-10
-- Auteur       : audit XSS Claude, validation Yannick
-- Périmètre    : workspaces.brand_color — enforce ^#[0-9a-fA-F]{6}$
-- Pré-requis   : aucun
--
-- ⚠️ AVANT D'EXÉCUTER :
--   Vérifier les valeurs actuelles non conformes (devrait être 0 ligne) :
--
--     SELECT id, name, brand_color
--     FROM workspaces
--     WHERE brand_color IS NOT NULL
--       AND brand_color !~ '^#[0-9a-fA-F]{6}$';
--
--   S'il y a des lignes : décider au cas par cas (NULL ou corriger).
--   Le UPDATE ci-dessous met les valeurs invalides à NULL (fallback safe).
--
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- 1) Nettoyer les valeurs invalides existantes (les remettre à NULL).
UPDATE workspaces
SET brand_color = NULL
WHERE brand_color IS NOT NULL
  AND brand_color !~ '^#[0-9a-fA-F]{6}$';

-- 2) Ajouter la contrainte. Bloque toute écriture future hors format.
ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_brand_color_format
  CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9a-fA-F]{6}$');

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATION POST-EXÉCUTION
-- ═══════════════════════════════════════════════════════════════════════
--
-- (a) La contrainte existe :
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.workspaces'::regclass
--     AND conname = 'workspaces_brand_color_format';
--
-- (b) Test fonctionnel — doit échouer :
--   UPDATE workspaces SET brand_color = 'red; foo: bar' WHERE id = '<some-id>';
--   -- Attendu : ERROR new row for relation "workspaces" violates check constraint
--
-- (c) Test fonctionnel — doit réussir :
--   UPDATE workspaces SET brand_color = '#ff8c32' WHERE id = '<some-id>';
--   UPDATE workspaces SET brand_color = NULL     WHERE id = '<some-id>';
