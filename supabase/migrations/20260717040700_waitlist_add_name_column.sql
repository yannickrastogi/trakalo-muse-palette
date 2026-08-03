-- Capturer le nom du demandeur d'early access (formulaire landing) en plus de l'email
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS name text;;
