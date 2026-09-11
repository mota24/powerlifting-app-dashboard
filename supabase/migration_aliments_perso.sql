-- Requiert public.compte_courant() : lancer d'abord migration_securite_comptes.sql.
-- ============================================================
-- MES PRODUITS — codes-barres absents d'Open Food Facts
-- À coller dans Supabase > SQL Editor.
--
-- Quand un code-barres scanné est inconnu (ou connu sans calories ni
-- protéines), l'app propose de saisir le produit une fois : il est gardé ici
-- et retrouvé directement au scan suivant, sans passer par Open Food Facts.
-- Cloisonné par compte, comme les autres tables (compte_courant() : e-mail du JWT en @power.app).
-- Idempotent : relançable sans risque. Ne modifie aucune donnée existante.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.aliments_perso (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text        NOT NULL DEFAULT public.compte_courant(),
  code_barres    text        NOT NULL CHECK (code_barres ~ '^[0-9]{6,14}$'),
  nom            text        NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 200),
  marque         text        CHECK (marque IS NULL OR char_length(marque) <= 200),
  kcal_100g      numeric     NOT NULL CHECK (kcal_100g >= 0 AND kcal_100g <= 1000),
  proteines_100g numeric     NOT NULL CHECK (proteines_100g >= 0 AND proteines_100g <= 100),
  portion_g      numeric     CHECK (portion_g IS NULL OR (portion_g > 0 AND portion_g <= 5000)),
  modifie_le     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code_barres)
);

ALTER TABLE public.aliments_perso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aliments_perso_select" ON public.aliments_perso;
DROP POLICY IF EXISTS "aliments_perso_insert" ON public.aliments_perso;
DROP POLICY IF EXISTS "aliments_perso_update" ON public.aliments_perso;
DROP POLICY IF EXISTS "aliments_perso_delete" ON public.aliments_perso;

CREATE POLICY "aliments_perso_select" ON public.aliments_perso FOR SELECT TO authenticated
  USING ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "aliments_perso_insert" ON public.aliments_perso FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "aliments_perso_update" ON public.aliments_perso FOR UPDATE TO authenticated
  USING ((SELECT public.compte_courant()) = user_id)
  WITH CHECK ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "aliments_perso_delete" ON public.aliments_perso FOR DELETE TO authenticated
  USING ((SELECT public.compte_courant()) = user_id);

REVOKE ALL ON public.aliments_perso FROM anon;

-- Recharge le cache de schéma de l'API, sinon la nouvelle table peut rester
-- invisible pour l'app pendant un moment.
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VÉRIFICATION — une seule ligne.
-- Attendu : rls_active = true,
--   policies = aliments_perso_delete:DELETE, aliments_perso_insert:INSERT,
--              aliments_perso_select:SELECT, aliments_perso_update:UPDATE
--   anon_peut_lire = false
-- ============================================================
SELECT
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.aliments_perso'::regclass) AS rls_active,
  (SELECT string_agg(p.policyname || ':' || p.cmd, ', ' ORDER BY p.policyname)
     FROM pg_policies p
     WHERE p.schemaname = 'public' AND p.tablename = 'aliments_perso') AS policies,
  has_table_privilege('anon', 'public.aliments_perso', 'SELECT') AS anon_peut_lire;
