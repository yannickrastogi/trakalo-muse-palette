-- Add-on workspace (2 août 2026) : 5 $/workspace/mois, plafond DUR à 15 au total.
-- Au-delà de 15, c'est un label ou une structure de management -> contact commercial,
-- produit sur mesure. Un workspace ne coûte quasiment rien (le stockage est plafonné
-- par utilisateur, pas par workspace) : il sert d'appât, le siège reste le revenu.
ALTER TABLE plan_limits
  ADD COLUMN IF NOT EXISTS workspace_addon_allowed     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workspace_addon_price_cents integer,
  ADD COLUMN IF NOT EXISTS workspaces_hard_cap         integer;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS purchased_workspaces integer NOT NULL DEFAULT 0;

UPDATE plan_limits SET workspace_addon_allowed = false,
                       workspace_addon_price_cents = NULL,
                       workspaces_hard_cap = NULL, updated_at = now()
WHERE plan IN ('free','starter','founder');

UPDATE plan_limits SET workspace_addon_allowed = true,
                       workspace_addon_price_cents = 500,
                       workspaces_hard_cap = 15, updated_at = now()
WHERE plan IN ('pro','business');

-- Le trigger tient compte des workspaces achetés et du plafond dur.
CREATE OR REPLACE FUNCTION public.enforce_workspace_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $func$
DECLARE v_max int; v_count int; v_purchased int; v_cap int; v_total int;
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;

  SELECT pl.workspaces_max, pl.workspaces_hard_cap, coalesce(s.purchased_workspaces,0)
    INTO v_max, v_cap, v_purchased
  FROM public.subscriptions s
  JOIN public.plan_limits pl ON pl.plan = s.plan
  WHERE s.user_id = NEW.owner_id;

  IF v_max IS NULL OR v_max = -1 THEN RETURN NEW; END IF;

  v_total := v_max + v_purchased;
  -- Le plafond dur prime : au-delà, passage obligatoire par le commercial.
  IF v_cap IS NOT NULL THEN v_total := least(v_total, v_cap); END IF;

  SELECT count(*) INTO v_count FROM public.workspaces WHERE owner_id = NEW.owner_id;

  IF v_count >= v_total THEN
    RAISE EXCEPTION 'plan_limit_reached: workspaces (%/%).', v_count, v_total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$func$;;
