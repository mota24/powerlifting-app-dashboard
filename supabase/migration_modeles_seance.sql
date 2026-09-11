-- Requiert public.compte_courant() : lancer d'abord migration_securite_comptes.sql.
-- ============================================================
-- MODÈLES DE SÉANCE — séances types rechargées en un appui
-- À coller dans Supabase > SQL Editor.
--
-- Un modèle = un nom (« Jambes ») et la liste de ses exercices : nom, séries
-- prescrites, notes. Rien de ce qui a été réellement fait n'y est gardé.
-- Cloisonné par compte, comme les autres tables (compte_courant() : e-mail du JWT en @power.app).
-- Idempotent : relançable sans risque. Ne modifie aucune donnée existante.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.modeles_seance (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text        NOT NULL DEFAULT public.compte_courant(),
  nom        text        NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 60),
  exercices  jsonb       NOT NULL CHECK (jsonb_typeof(exercices) = 'array' AND octet_length(exercices::text) <= 50000),
  cree_le    timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modeles_seance_user
  ON public.modeles_seance (user_id, nom);

ALTER TABLE public.modeles_seance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modeles_select" ON public.modeles_seance;
DROP POLICY IF EXISTS "modeles_insert" ON public.modeles_seance;
DROP POLICY IF EXISTS "modeles_update" ON public.modeles_seance;
DROP POLICY IF EXISTS "modeles_delete" ON public.modeles_seance;

CREATE POLICY "modeles_select" ON public.modeles_seance FOR SELECT TO authenticated
  USING ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "modeles_insert" ON public.modeles_seance FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "modeles_update" ON public.modeles_seance FOR UPDATE TO authenticated
  USING ((SELECT public.compte_courant()) = user_id)
  WITH CHECK ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "modeles_delete" ON public.modeles_seance FOR DELETE TO authenticated
  USING ((SELECT public.compte_courant()) = user_id);

REVOKE ALL ON public.modeles_seance FROM anon;

-- Recharge le cache de schéma de l'API, sinon la nouvelle table peut rester
-- invisible pour l'app pendant un moment.
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VÉRIFICATION — une seule ligne.
-- Attendu : rls_active = true,
--   policies = modeles_delete:DELETE, modeles_insert:INSERT, modeles_select:SELECT, modeles_update:UPDATE
--   anon_peut_lire = false
-- ============================================================
SELECT
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.modeles_seance'::regclass) AS rls_active,
  (SELECT string_agg(p.policyname || ':' || p.cmd, ', ' ORDER BY p.policyname)
     FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = 'modeles_seance') AS policies,
  has_table_privilege('anon', 'public.modeles_seance', 'SELECT') AS anon_peut_lire;
