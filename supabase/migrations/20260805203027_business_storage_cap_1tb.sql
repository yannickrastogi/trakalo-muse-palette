-- Plafond de stockage Business ramené de 2 To à 1 To (5 août 2026).
-- Raison : à 0,015 $/Go/mois sur Cloudflare R2, 2 To coûtent ~30 $/mois pour un abonnement
-- facturé 45 $ — marge trop mince si un client remplit son quota. 1 To ramène le coût
-- plafond à ~15 $, soit un tiers du revenu, ce qui reste sain.
-- Aucun utilisateur n'est impacté : le plus gros consommateur actuel est à 1,95 Go.
UPDATE plan_limits
SET storage_bytes_max = 1000000000000, updated_at = now()
WHERE plan = 'business';;
