-- ============================================================
-- HOTFIX — RÉTABLIT L'ÉCRITURE EN BASE (erreur 403 / app "hors ligne")
-- À coller EN ENTIER dans Supabase > SQL Editor, puis cliquer RUN.
--
-- CE QUI S'EST PASSÉ
-- RLS (Row Level Security) a bien été activé sur workout_sets,
-- training_blocks et user_progress — c'était nécessaire, ces tables
-- étaient ouvertes à tous. Mais activer RLS SANS créer de policy
-- signifie « refuser tout le monde », y compris le compte légitime :
-- Postgres refuse par défaut et n'autorise que ce qu'une policy
-- autorise explicitement. D'où les 403 à l'écriture et les listes
-- vides en lecture.
--
-- Ce fichier crée les policies manquantes. Aucune donnée n'est
-- touchée : les 114 séances, 2 blocs et la progression sont intacts,
-- simplement masqués par RLS tant qu'aucune policy ne les autorise.
-- ============================================================

-- Ces tables n'ont pas de colonne user_id : le modèle de l'app est
-- mono-athlète, données partagées entre les comptes autorisés
-- (athlète + coach). La règle est donc « il faut être connecté » —
-- ce qui ferme bien la faille : le rôle anon, lui, n'a aucun accès.

-- 1. WORKOUT_SETS (séances)
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workout_sets_authentifies" ON workout_sets;
CREATE POLICY "workout_sets_authentifies"
  ON workout_sets FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- 2. TRAINING_BLOCKS (blocs d'entraînement)
ALTER TABLE training_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_blocks_authentifies" ON training_blocks;
CREATE POLICY "training_blocks_authentifies"
  ON training_blocks FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- 3. USER_PROGRESS (niveau, XP, streak)
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_progress_authentifies" ON user_progress;
CREATE POLICY "user_progress_authentifies"
  ON user_progress FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- 4. SEANCES_PAS : lecture seule pour les connectés. L'écriture reste
--    réservée au serveur (/api/sync-steps, clé service_role).
ALTER TABLE seances_pas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lecture_pas_authentifies" ON seances_pas;
CREATE POLICY "lecture_pas_authentifies"
  ON seances_pas FOR SELECT
  TO authenticated
  USING (true);

-- 5. Verrou explicite : aucun privilège pour les visiteurs non connectés,
--    même si une policy venait à changer plus tard.
REVOKE ALL ON workout_sets, training_blocks, user_progress, seances_pas FROM anon;

-- ============================================================
-- VÉRIFICATION — doit renvoyer 4 lignes (une policy par table).
-- Si une table manque, sa création a échoué : relance le bloc concerné.
-- ============================================================
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('workout_sets', 'training_blocks', 'user_progress', 'seances_pas')
ORDER BY tablename;
