-- ============================================================
-- MIGRATION PALMARÈS V2 — à coller dans Supabase > SQL Editor
-- (à exécuter APRÈS migration_palmares.sql)
--
-- Ajoute les 9 essais individuels, le classement, le niveau de
-- compétition et une galerie (plusieurs photos au lieu d'une).
-- Idempotente : peut être relancée sans risque.
-- ============================================================

-- 1. MÉTADONNÉES
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS placement SMALLINT,
  ADD COLUMN IF NOT EXISTS level TEXT;

-- Le classement est un rang : 1, 2, 3… (jamais 0 ni négatif)
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_placement_positif;
ALTER TABLE competitions
  ADD CONSTRAINT competitions_placement_positif
  CHECK (placement IS NULL OR placement > 0);

-- 2. GALERIE : plusieurs URLs de photos par compétition
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';

-- Reprise de l'unique photo déjà saisie dans le nouveau tableau,
-- avant de retirer l'ancienne colonne (aucune donnée perdue).
UPDATE competitions
  SET photo_urls = ARRAY[photo_url]
  WHERE photo_url IS NOT NULL
    AND photo_url <> ''
    AND cardinality(photo_urls) = 0;

ALTER TABLE competitions DROP COLUMN IF EXISTS photo_url;

-- 3. LES 9 ESSAIS
--
-- Convention OpenPowerlifting, reprise telle quelle :
--   valeur POSITIVE  → essai VALIDÉ      (ex:  295 = 295 kg réussis)
--   valeur NÉGATIVE  → essai MANQUÉ      (ex: -175 = 175 kg manqués)
--   NULL             → essai NON TENTÉ
--
-- Les colonnes squat / bench / deadlift restent la meilleure barre
-- VALIDÉE du mouvement : elles sont recalculées à chaque saisie des
-- essais, et restent saisissables seules (compétition à venir, ou
-- résultat connu sans détail des essais).
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS squat_1 NUMERIC,
  ADD COLUMN IF NOT EXISTS squat_2 NUMERIC,
  ADD COLUMN IF NOT EXISTS squat_3 NUMERIC,
  ADD COLUMN IF NOT EXISTS bench_1 NUMERIC,
  ADD COLUMN IF NOT EXISTS bench_2 NUMERIC,
  ADD COLUMN IF NOT EXISTS bench_3 NUMERIC,
  ADD COLUMN IF NOT EXISTS deadlift_1 NUMERIC,
  ADD COLUMN IF NOT EXISTS deadlift_2 NUMERIC,
  ADD COLUMN IF NOT EXISTS deadlift_3 NUMERIC;
