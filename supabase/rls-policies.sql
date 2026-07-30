-- ============================================================
-- POLICIES RLS CONSOLIDÉES — à coller dans Supabase > SQL Editor
-- Idempotent (DROP POLICY IF EXISTS + CREATE) : peut être relancé
-- sans risque, y compris si tout est déjà correct.
--
-- ⚠️ CE FICHIER N'UTILISE PAS `auth.uid() = user_id`.
-- Vérification du schéma réel (colonnes de chaque table, lues via
-- service_role le 29/07) :
--
--   workout_sets, training_blocks, user_progress
--     → AUCUNE colonne user_id. `auth.uid() = user_id` échouerait à
--       la création même de la policy (colonne inexistante).
--
--   seances_pas, bodyweight_logs, competitions
--     → une colonne user_id, mais de type TEXT, dérivée du préfixe
--       d'email (ex. "mota24"), PAS un UUID. `auth.uid()` renvoie
--       l'UUID interne Supabase Auth (ex. 576a57f1-...) : la
--       comparaison ne matcherait JAMAIS, même pour le bon compte.
--       Il faut comparer au préfixe d'email du JWT, pas à auth.uid().
--
-- Modèle réel de l'app (documenté aussi dans policies_securite.sql) :
-- un seul athlète, données partagées entre les comptes autorisés
-- (athlète + coach). Pas de multi-tenant : "propriétaire de la ligne"
-- n'a de sens que pour 3 tables sur 6, les autres sont volontairement
-- partagées entre tout compte authentifié.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. WORKOUT_SETS, TRAINING_BLOCKS, USER_PROGRESS
--    Pas de user_id : la seule frontière possible est "être connecté".
--    Résultat attendu après exécution : un compte authentifié voit et
--    modifie tout ; anon n'a aucun accès (ni lecture, ni écriture).
-- ────────────────────────────────────────────────────────────

ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workout_sets_select" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_insert" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_update" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_delete" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_authentifies" ON workout_sets; -- ancien nom (policy fusionnée)
CREATE POLICY "workout_sets_select" ON workout_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "workout_sets_insert" ON workout_sets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "workout_sets_update" ON workout_sets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "workout_sets_delete" ON workout_sets FOR DELETE TO authenticated USING (true);

ALTER TABLE training_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_blocks_select" ON training_blocks;
DROP POLICY IF EXISTS "training_blocks_insert" ON training_blocks;
DROP POLICY IF EXISTS "training_blocks_update" ON training_blocks;
DROP POLICY IF EXISTS "training_blocks_delete" ON training_blocks;
DROP POLICY IF EXISTS "training_blocks_authentifies" ON training_blocks;
CREATE POLICY "training_blocks_select" ON training_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_blocks_insert" ON training_blocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "training_blocks_update" ON training_blocks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "training_blocks_delete" ON training_blocks FOR DELETE TO authenticated USING (true);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_progress_select" ON user_progress;
DROP POLICY IF EXISTS "user_progress_insert" ON user_progress;
DROP POLICY IF EXISTS "user_progress_update" ON user_progress;
DROP POLICY IF EXISTS "user_progress_delete" ON user_progress;
DROP POLICY IF EXISTS "user_progress_authentifies" ON user_progress;
CREATE POLICY "user_progress_select" ON user_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_progress_insert" ON user_progress FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "user_progress_update" ON user_progress FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "user_progress_delete" ON user_progress FOR DELETE TO authenticated USING (true);


-- ────────────────────────────────────────────────────────────
-- 2. SEANCES_PAS
--    A un user_id, mais l'écriture est volontairement RÉSERVÉE AU
--    SERVEUR : /api/sync-steps vérifie le SYNC_SECRET *et* compare
--    déjà le userId reçu à NEXT_PUBLIC_SYNC_USER_ID avant d'écrire
--    via service_role (qui contourne RLS). Aucune policy client
--    INSERT/UPDATE/DELETE n'est donc créée ici : ce n'est pas un
--    oubli, c'est délibéré. Seule la lecture est ouverte aux
--    comptes connectés.
--    Résultat attendu : lecture OK pour un compte connecté, écriture
--    refusée même pour un compte connecté (design voulu).
-- ────────────────────────────────────────────────────────────

ALTER TABLE seances_pas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lecture_pas_authentifies" ON seances_pas;
CREATE POLICY "lecture_pas_authentifies" ON seances_pas FOR SELECT TO authenticated USING (true);


-- ────────────────────────────────────────────────────────────
-- 3. BODYWEIGHT_LOGS — isolation RÉELLE par utilisateur (contrairement
--    aux tables ci-dessus). user_id = préfixe d'email, comparé au
--    préfixe d'email du JWT — jamais à auth.uid().
--    Résultat attendu : un compte ne voit et ne modifie QUE les lignes
--    dont user_id correspond à son propre préfixe d'email.
-- ────────────────────────────────────────────────────────────

ALTER TABLE bodyweight_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bodyweight_logs_select" ON bodyweight_logs;
DROP POLICY IF EXISTS "bodyweight_logs_insert" ON bodyweight_logs;
DROP POLICY IF EXISTS "bodyweight_logs_update" ON bodyweight_logs;
DROP POLICY IF EXISTS "bodyweight_logs_delete" ON bodyweight_logs;
DROP POLICY IF EXISTS "bodyweight_logs_authentifies" ON bodyweight_logs; -- ancien nom (policy fusionnée)

CREATE POLICY "bodyweight_logs_select" ON bodyweight_logs FOR SELECT TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "bodyweight_logs_insert" ON bodyweight_logs FOR INSERT TO authenticated
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
-- WITH CHECK sur l'UPDATE : sans lui, un utilisateur pourrait modifier
-- une ligne lui appartenant pour la RÉASSIGNER à un autre user_id.
CREATE POLICY "bodyweight_logs_update" ON bodyweight_logs FOR UPDATE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id)
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "bodyweight_logs_delete" ON bodyweight_logs FOR DELETE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);


-- ────────────────────────────────────────────────────────────
-- 4. COMPETITIONS — même isolation par préfixe d'email que bodyweight_logs.
-- ────────────────────────────────────────────────────────────

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competitions_select" ON competitions;
DROP POLICY IF EXISTS "competitions_insert" ON competitions;
DROP POLICY IF EXISTS "competitions_update" ON competitions;
DROP POLICY IF EXISTS "competitions_delete" ON competitions;
DROP POLICY IF EXISTS "competitions_authentifies" ON competitions; -- ancien nom (policy fusionnée)

CREATE POLICY "competitions_select" ON competitions FOR SELECT TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "competitions_insert" ON competitions FOR INSERT TO authenticated
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "competitions_update" ON competitions FOR UPDATE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id)
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "competitions_delete" ON competitions FOR DELETE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);


-- ────────────────────────────────────────────────────────────
-- 5. AUTH_FAILED_ATTEMPTS (rate limiting) — strictement serveur.
--    RLS activé, AUCUNE policy pour anon ni authenticated : refusé à
--    tout le monde sauf service_role (qui contourne RLS). C'est le
--    seul cas où "RLS actif + zéro policy" est le comportement voulu.
-- ────────────────────────────────────────────────────────────

ALTER TABLE auth_failed_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_failed_attempts FROM anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. VERROU EXPLICITE — indépendant des policies : même si une policy
--    changeait par erreur demain, ceci retire tout privilège brut au
--    rôle anon sur les tables applicatives.
-- ────────────────────────────────────────────────────────────

REVOKE ALL ON workout_sets, training_blocks, user_progress, seances_pas,
             bodyweight_logs, competitions
  FROM anon;


-- ────────────────────────────────────────────────────────────
-- 7. STORAGE — photos de compétitions : lecture publique uniquement,
--    écriture strictement serveur (service_role, /api/palmares/photo).
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "competition_photos_lecture_publique" ON storage.objects;
CREATE POLICY "competition_photos_lecture_publique"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'competition-photos');
-- Aucune policy INSERT/UPDATE/DELETE : ni anon ni authenticated ne
-- peuvent écrire dans ce bucket, uniquement service_role.


-- ============================================================
-- VÉRIFICATION — à lancer juste après. Attendu : 4 lignes pour
-- workout_sets/training_blocks/user_progress (select/insert/update/
-- delete), 1 pour seances_pas (select), 4 chacune pour bodyweight_logs
-- et competitions, 0 pour auth_failed_attempts.
-- ============================================================
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
