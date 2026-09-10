-- ============================================================
-- PHASE 5 — Journal alimentaire (calories et protéines)
-- À coller dans Supabase > SQL Editor.
--
-- Une ligne = un aliment mangé un jour donné : quantité en grammes, et
-- valeurs pour 100 g copiées d'Open Food Facts ou saisies à la main.
-- On copie les valeurs au lieu de ne garder que le code-barres : Open Food
-- Facts évolue, et un journal ne doit pas changer après coup.
--
-- Cloisonné par compte, comme les autres tables (préfixe d'email du JWT).
-- Idempotent : relançable sans risque. Ne modifie aucune donnée existante.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journal_alimentaire (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text        NOT NULL DEFAULT split_part(((current_setting('request.jwt.claims', true))::jsonb ->> 'email'), '@', 1),
  date           date        NOT NULL,
  nom            text        NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 200),
  marque         text        CHECK (marque IS NULL OR char_length(marque) <= 200),
  code_barres    text        CHECK (code_barres IS NULL OR code_barres ~ '^[0-9]{6,14}$'),
  grammes        numeric     NOT NULL CHECK (grammes > 0 AND grammes <= 5000),
  kcal_100g      numeric     NOT NULL CHECK (kcal_100g >= 0 AND kcal_100g <= 1000),
  proteines_100g numeric     NOT NULL CHECK (proteines_100g >= 0 AND proteines_100g <= 100),
  cree_le        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_alimentaire_user_date
  ON public.journal_alimentaire (user_id, date);

ALTER TABLE public.journal_alimentaire ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_select" ON public.journal_alimentaire;
DROP POLICY IF EXISTS "journal_insert" ON public.journal_alimentaire;
DROP POLICY IF EXISTS "journal_update" ON public.journal_alimentaire;
DROP POLICY IF EXISTS "journal_delete" ON public.journal_alimentaire;

CREATE POLICY "journal_select" ON public.journal_alimentaire FOR SELECT TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "journal_insert" ON public.journal_alimentaire FOR INSERT TO authenticated
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "journal_update" ON public.journal_alimentaire FOR UPDATE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id)
  WITH CHECK (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);
CREATE POLICY "journal_delete" ON public.journal_alimentaire FOR DELETE TO authenticated
  USING (split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id);

REVOKE ALL ON public.journal_alimentaire FROM anon;

-- Recharge le cache de schéma de l'API, sinon la nouvelle table peut rester
-- invisible pour l'app pendant un moment.
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VÉRIFICATION — une seule ligne, aucun contrôle de transaction
-- (le SQL Editor exécute le script comme une seule transaction).
-- Attendu : rls_active = true,
--   policies = journal_delete:DELETE, journal_insert:INSERT, journal_select:SELECT, journal_update:UPDATE
--   anon_peut_lire = false
-- ============================================================
SELECT
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.journal_alimentaire'::regclass) AS rls_active,
  (SELECT string_agg(p.policyname || ':' || p.cmd, ', ' ORDER BY p.policyname)
     FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = 'journal_alimentaire') AS policies,
  has_table_privilege('anon', 'public.journal_alimentaire', 'SELECT') AS anon_peut_lire;
