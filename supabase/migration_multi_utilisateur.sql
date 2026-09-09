-- ============================================================
-- MIGRATION MULTI-UTILISATEUR — à coller dans Supabase > SQL Editor
--
-- Objectif : cloisonner réellement les données entre le compte 1
-- (toi, powerlifting) et le compte 2 (elle, fitness).
--
-- État avant cette migration (vérifié en lecture seule) :
--   workout_sets (128 lignes), training_blocks (2), user_progress (1)
--   n'ont AUCUNE colonne user_id, et leur policy RLS dit
--   "TO authenticated USING (true)" — donc le compte 2 voit, modifie
--   et peut supprimer TOUTES tes séances, et vous partagez le même
--   XP / niveau / streak (une seule ligne user_progress).
--
--   seances_pas, bodyweight_logs et competitions ont déjà un user_id
--   et sont déjà cloisonnés : ils ne sont pas touchés ici.
--
-- Idempotent : relançable sans risque.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. TABLE profiles — thème + mode d'app par utilisateur
--
-- ⚠️ Cette table a été créée sans RLS : elle est actuellement
-- LISIBLE ET MODIFIABLE sans aucune authentification (vérifié :
-- la clé anon publique suffit à lire les deux profils et à changer
-- un thème). On la verrouille ici.
-- ────────────────────────────────────────────────────────────

-- Mode d'app : 'powerlifting' (compét, IPF, Palmarès) ou 'fitness'
-- (salle, sans compét). Pilote le contenu affiché côté app.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'powerlifting';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_mode_valide;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_mode_valide
  CHECK (mode IN ('powerlifting', 'fitness'));

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ici (et seulement ici), auth.uid() est la bonne comparaison :
-- profiles.id EST l'UUID Supabase Auth. Les autres tables utilisent
-- un user_id TEXT dérivé du préfixe d'email, jamais un UUID.
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
-- Pas de policy INSERT/DELETE : la création d'un profil reste une
-- opération d'administration (service_role / SQL Editor).

REVOKE ALL ON profiles FROM anon;


-- ────────────────────────────────────────────────────────────
-- 2. CLOISONNEMENT des 3 tables partagées
--
-- Procédé en 4 temps, volontairement dans cet ordre : la colonne est
-- d'abord nullable, on remplit l'existant, PUIS on pose le DEFAULT et
-- le NOT NULL. Poser le DEFAULT dès l'ajout ne marcherait pas : dans
-- le SQL Editor il n'y a pas de JWT, donc split_part(...) renverrait
-- une chaîne vide sur toutes les lignes existantes.
-- ────────────────────────────────────────────────────────────

-- 2a. workout_sets
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS user_id TEXT;
UPDATE workout_sets SET user_id = '1' WHERE user_id IS NULL;  -- tout l'historique existant est le tien
ALTER TABLE workout_sets
  ALTER COLUMN user_id SET DEFAULT split_part(((current_setting('request.jwt.claims', true))::jsonb ->> 'email'), '@', 1);
ALTER TABLE workout_sets ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workout_sets_user_date ON workout_sets (user_id, date);

-- 2b. training_blocks
ALTER TABLE training_blocks ADD COLUMN IF NOT EXISTS user_id TEXT;
UPDATE training_blocks SET user_id = '1' WHERE user_id IS NULL;
ALTER TABLE training_blocks
  ALTER COLUMN user_id SET DEFAULT split_part(((current_setting('request.jwt.claims', true))::jsonb ->> 'email'), '@', 1);
ALTER TABLE training_blocks ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_blocks_user ON training_blocks (user_id, start_date);

-- 2c. user_progress (XP / niveau / streak)
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS user_id TEXT;
UPDATE user_progress SET user_id = '1' WHERE user_id IS NULL;
ALTER TABLE user_progress
  ALTER COLUMN user_id SET DEFAULT split_part(((current_setting('request.jwt.claims', true))::jsonb ->> 'email'), '@', 1);
ALTER TABLE user_progress ALTER COLUMN user_id SET NOT NULL;
-- Un seul compteur de progression par personne
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress (user_id);


-- ────────────────────────────────────────────────────────────
-- 3. POLICIES RLS — chacun ne voit que ses propres lignes
--    (même modèle que bodyweight_logs / competitions : comparaison
--    au préfixe d'email du JWT, pas à auth.uid())
-- ────────────────────────────────────────────────────────────

-- workout_sets
DROP POLICY IF EXISTS "workout_sets_select" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_insert" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_update" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_delete" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_authentifies" ON workout_sets;
CREATE POLICY "workout_sets_select" ON workout_sets FOR SELECT TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "workout_sets_insert" ON workout_sets FOR INSERT TO authenticated
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "workout_sets_update" ON workout_sets FOR UPDATE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id)
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "workout_sets_delete" ON workout_sets FOR DELETE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);

-- training_blocks
DROP POLICY IF EXISTS "training_blocks_select" ON training_blocks;
DROP POLICY IF EXISTS "training_blocks_insert" ON training_blocks;
DROP POLICY IF EXISTS "training_blocks_update" ON training_blocks;
DROP POLICY IF EXISTS "training_blocks_delete" ON training_blocks;
DROP POLICY IF EXISTS "training_blocks_authentifies" ON training_blocks;
CREATE POLICY "training_blocks_select" ON training_blocks FOR SELECT TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "training_blocks_insert" ON training_blocks FOR INSERT TO authenticated
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "training_blocks_update" ON training_blocks FOR UPDATE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id)
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "training_blocks_delete" ON training_blocks FOR DELETE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);

-- user_progress
DROP POLICY IF EXISTS "user_progress_select" ON user_progress;
DROP POLICY IF EXISTS "user_progress_insert" ON user_progress;
DROP POLICY IF EXISTS "user_progress_update" ON user_progress;
DROP POLICY IF EXISTS "user_progress_delete" ON user_progress;
DROP POLICY IF EXISTS "user_progress_authentifies" ON user_progress;
CREATE POLICY "user_progress_select" ON user_progress FOR SELECT TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "user_progress_insert" ON user_progress FOR INSERT TO authenticated
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "user_progress_update" ON user_progress FOR UPDATE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id)
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "user_progress_delete" ON user_progress FOR DELETE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);

REVOKE ALL ON workout_sets, training_blocks, user_progress FROM anon;


-- ────────────────────────────────────────────────────────────
-- 4. AMORÇAGE du compte 2
--    Sans ligne user_progress, l'app plante en 406 sur .single().
-- ────────────────────────────────────────────────────────────

INSERT INTO user_progress (user_id, level, current_xp, total_xp, streak_days)
SELECT '2', 1, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM user_progress WHERE user_id = '2');

-- Modes d'app : compte 1 = powerlifting, compte 2 = fitness
UPDATE profiles SET mode = 'powerlifting'
  WHERE id = (SELECT id FROM auth.users WHERE email = '1@power.app');
UPDATE profiles SET mode = 'fitness', theme = 'pink'
  WHERE id = (SELECT id FROM auth.users WHERE email = '2@power.app');


-- ============================================================
-- VÉRIFICATION — à lancer juste après.
-- Attendu : workout_sets 128 lignes pour '1' et 0 pour '2' ;
-- user_progress une ligne par compte ; profiles avec les 2 modes.
-- ============================================================
SELECT 'workout_sets' AS table_name, user_id, count(*) FROM workout_sets GROUP BY user_id
UNION ALL SELECT 'training_blocks', user_id, count(*) FROM training_blocks GROUP BY user_id
UNION ALL SELECT 'user_progress', user_id, count(*) FROM user_progress GROUP BY user_id
ORDER BY table_name, user_id;

SELECT u.email, p.theme, p.mode
FROM profiles p JOIN auth.users u ON u.id = p.id
ORDER BY u.email;
