-- ============================================================
-- MIGRATION POWERAPP — à coller dans Supabase > SQL Editor
-- (obligatoire pour la sync des pas et le drapeau douleur)
-- ============================================================

-- 1. PAS QUOTIDIENS : dédoublonnage puis unicité (user, jour)
--    Permet l'upsert idempotent de /api/sync-steps.
DELETE FROM seances_pas a USING seances_pas b
  WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.date = b.date;

ALTER TABLE seances_pas
  ADD CONSTRAINT seances_pas_user_date_key UNIQUE (user_id, date);

-- 2. INDEX DE PERFORMANCE
--    Toutes les requêtes de l'app filtrent/trient par date.
CREATE INDEX IF NOT EXISTS idx_workout_sets_date
  ON workout_sets (date, order_index);

CREATE INDEX IF NOT EXISTS idx_training_blocks_start
  ON training_blocks (start_date);

-- 3. DRAPEAU DOULEUR (rééducation lombaire)
--    0 = OK · 1 = Gêne · 2 = Douleur · 3 = Stop
ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS pain_level smallint
  CHECK (pain_level BETWEEN 0 AND 3);

-- ============================================================
-- RAPPEL SÉCURITÉ (à vérifier dans Authentication > Policies) :
-- RLS doit être ACTIVÉ sur workout_sets, training_blocks,
-- user_progress et seances_pas. La clé anon est publique dans
-- le bundle JS : sans RLS, toutes les données sont ouvertes.
-- ============================================================
