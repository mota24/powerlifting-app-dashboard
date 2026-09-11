-- Requiert public.compte_courant() : lancer d'abord migration_securite_comptes.sql.
-- ============================================================
-- OBJECTIFS NUTRITION — calories et protéines par jour
-- À coller dans Supabase > SQL Editor.
--
-- Une ligne par compte au plus : l'app l'écrit en « crée ou remplace ».
-- Une valeur vide (NULL) = pas d'objectif pour cette mesure.
-- Cloisonné par compte, comme les autres tables (compte_courant() : e-mail du JWT en @power.app).
-- Idempotent : relançable sans risque. Ne modifie aucune donnée existante.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.objectifs_nutrition (
  user_id    text        PRIMARY KEY DEFAULT public.compte_courant(),
  kcal       integer     CHECK (kcal IS NULL OR kcal BETWEEN 800 AND 8000),
  proteines  integer     CHECK (proteines IS NULL OR proteines BETWEEN 20 AND 400),
  modifie_le timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.objectifs_nutrition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "objectifs_select" ON public.objectifs_nutrition;
DROP POLICY IF EXISTS "objectifs_insert" ON public.objectifs_nutrition;
DROP POLICY IF EXISTS "objectifs_update" ON public.objectifs_nutrition;

CREATE POLICY "objectifs_select" ON public.objectifs_nutrition FOR SELECT TO authenticated
  USING ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "objectifs_insert" ON public.objectifs_nutrition FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "objectifs_update" ON public.objectifs_nutrition FOR UPDATE TO authenticated
  USING ((SELECT public.compte_courant()) = user_id)
  WITH CHECK ((SELECT public.compte_courant()) = user_id);

REVOKE ALL ON public.objectifs_nutrition FROM anon;

-- Recharge le cache de schéma de l'API, sinon la nouvelle table peut rester
-- invisible pour l'app pendant un moment.
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VÉRIFICATION — une seule ligne.
-- Attendu : rls_active = true,
--   policies = objectifs_insert:INSERT, objectifs_select:SELECT, objectifs_update:UPDATE
--   anon_peut_lire = false
-- ============================================================
SELECT
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.objectifs_nutrition'::regclass) AS rls_active,
  (SELECT string_agg(p.policyname || ':' || p.cmd, ', ' ORDER BY p.policyname)
     FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = 'objectifs_nutrition') AS policies,
  has_table_privilege('anon', 'public.objectifs_nutrition', 'SELECT') AS anon_peut_lire;
