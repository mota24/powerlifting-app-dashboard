-- Requiert public.compte_courant() : lancer d'abord migration_securite_comptes.sql.
-- ============================================================
-- RECORDS PERSONNELS — les maximums saisis à la main (écran Analytique)
-- À coller dans Supabase > SQL Editor.
--
-- Jusqu'ici ils ne vivaient que dans le navigateur : session expirée, stockage
-- vidé par iOS ou changement de téléphone, et ils étaient à ressaisir.
-- Une ligne par compte, cloisonnée comme les autres tables.
-- Idempotent : relançable sans risque. Ne modifie aucune donnée existante.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.records_perso (
  user_id    text        PRIMARY KEY DEFAULT public.compte_courant(),
  squat      numeric     NOT NULL DEFAULT 0 CHECK (squat BETWEEN 0 AND 1000),
  bench      numeric     NOT NULL DEFAULT 0 CHECK (bench BETWEEN 0 AND 1000),
  deadlift   numeric     NOT NULL DEFAULT 0 CHECK (deadlift BETWEEN 0 AND 1000),
  modifie_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.records_perso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "records_perso_select" ON public.records_perso;
DROP POLICY IF EXISTS "records_perso_insert" ON public.records_perso;
DROP POLICY IF EXISTS "records_perso_update" ON public.records_perso;

CREATE POLICY "records_perso_select" ON public.records_perso FOR SELECT TO authenticated
  USING ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "records_perso_insert" ON public.records_perso FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "records_perso_update" ON public.records_perso FOR UPDATE TO authenticated
  USING ((SELECT public.compte_courant()) = user_id)
  WITH CHECK ((SELECT public.compte_courant()) = user_id);

-- Pas de policy DELETE : remettre les records à zéro se fait en les modifiant.
REVOKE ALL ON public.records_perso FROM anon;

-- Recharge le cache de schéma de l'API, sinon la nouvelle table peut rester
-- invisible pour l'app pendant un moment.
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VÉRIFICATION — une seule ligne.
-- Attendu : rls_active = true,
--   policies = records_perso_insert:INSERT, records_perso_select:SELECT, records_perso_update:UPDATE
--   anon_peut_lire = false
-- ============================================================
SELECT
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.records_perso'::regclass) AS rls_active,
  (SELECT string_agg(p.policyname || ':' || p.cmd, ', ' ORDER BY p.policyname)
     FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = 'records_perso') AS policies,
  has_table_privilege('anon', 'public.records_perso', 'SELECT') AS anon_peut_lire;
