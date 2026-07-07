-- ============================================================
-- POLICIES DE SÉCURITÉ — à coller dans Supabase > SQL Editor
--
-- Les droits d'accès sont appliqués PAR LA BASE (Row Level
-- Security), donc côté serveur : un utilisateur ne peut pas les
-- contourner en modifiant le JavaScript de la page. La clé anon
-- étant publique dans le bundle, sans RLS toutes les tables
-- seraient ouvertes à n'importe qui.
--
-- Modèle de l'app : un seul athlète, données partagées entre les
-- comptes autorisés (athlète + coach). Les policies exigent donc
-- simplement un compte CONNECTÉ ; les visiteurs anonymes n'ont
-- aucun accès.
-- ============================================================

-- 1. WORKOUT_SETS : lecture/écriture réservées aux comptes connectés
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workout_sets_authentifies" ON workout_sets;
CREATE POLICY "workout_sets_authentifies"
  ON workout_sets FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- 2. TRAINING_BLOCKS : idem
ALTER TABLE training_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_blocks_authentifies" ON training_blocks;
CREATE POLICY "training_blocks_authentifies"
  ON training_blocks FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- 3. USER_PROGRESS : idem
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_progress_authentifies" ON user_progress;
CREATE POLICY "user_progress_authentifies"
  ON user_progress FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- 4. SEANCES_PAS : lecture seule pour les connectés.
--    L'ÉCRITURE reste réservée au serveur (service_role via
--    /api/sync-steps protégée par SYNC_SECRET) : aucune policy
--    INSERT/UPDATE/DELETE n'est créée pour les clients.
ALTER TABLE seances_pas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lecture_pas_authentifies" ON seances_pas;
CREATE POLICY "lecture_pas_authentifies"
  ON seances_pas FOR SELECT
  TO authenticated
  USING (true);

-- 5. Verrou explicite : aucun privilège pour les visiteurs non
--    connectés (rôle anon), même si une policy venait à changer.
REVOKE ALL ON workout_sets, training_blocks, user_progress, seances_pas FROM anon;
