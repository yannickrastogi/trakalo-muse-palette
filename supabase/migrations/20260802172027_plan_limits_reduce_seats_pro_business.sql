-- Révision du modèle de sièges (2 août 2026) : on était trop généreux.
-- Les workspaces ne coûtent rien à produire, les sièges sont le levier de revenu.
-- Pro      : 5 sièges / 5 workspaces  ->  2 sièges / 4 workspaces
-- Business : 10 sièges / 15 workspaces -> 5 sièges / 10 workspaces
-- Les viewers restent gratuits et illimités sur Pro et Business (modèle Figma).
-- Add-on siège inchangé : 10 $/siège/mois.
UPDATE plan_limits
SET seats_included = 2, workspaces_max = 4, updated_at = now()
WHERE plan = 'pro';

UPDATE plan_limits
SET seats_included = 5, workspaces_max = 10, updated_at = now()
WHERE plan = 'business';;
