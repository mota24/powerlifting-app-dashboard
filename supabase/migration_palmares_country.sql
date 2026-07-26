-- ============================================================
-- MIGRATION PALMARÈS — PAYS DE LA COMPÉTITION
-- à coller dans Supabase > SQL Editor
-- (à exécuter APRÈS migration_palmares_v2.sql)
--
-- On stocke le code ISO 3166-1 alpha-2 ('ES', 'FR') et non l'émoji :
-- deux caractères, comparables et triables, à partir desquels l'app
-- dérive le drapeau. Idempotente, et sans effet sur les lignes déjà
-- présentes (country_code reste NULL → aucun drapeau affiché).
-- ============================================================

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS country_code TEXT;

-- Deux lettres majuscules, ou rien : empêche d'y ranger « Espagne » ou un
-- émoji, ce qui casserait la conversion en drapeau côté app.
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_country_code_iso;
ALTER TABLE competitions
  ADD CONSTRAINT competitions_country_code_iso
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

-- OPTIONNEL — les deux compétitions déjà enregistrées sont des compétitions
-- de la fédération espagnole. Décommente pour leur affecter l'Espagne d'un
-- coup, plutôt que de les éditer une par une dans l'app.
--
-- UPDATE competitions SET country_code = 'ES' WHERE country_code IS NULL;
