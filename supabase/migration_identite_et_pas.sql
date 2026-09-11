-- Requiert public.compte_courant() : lancer d'abord migration_securite_comptes.sql.
-- ============================================================
-- PHASE 1 — Identité (prénom, langue) et cloisonnement des pas
-- À coller dans Supabase > SQL Editor.
--
-- Contexte : la migration multi-utilisateur a cloisonné workout_sets,
-- training_blocks et user_progress. Il restait une fuite sur seances_pas :
--   - sa policy était encore "TO authenticated USING (true)" (partagée) ;
--   - ses 41 lignes portent un identifiant de synchro unique, commun aux
--     deux comptes, et non le préfixe d'email.
-- Résultat aujourd'hui : le compte 2 verrait les pas du compte 1.
--
-- Idempotent : relançable sans risque.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. IDENTITÉ — prénom affiché et langue de l'interface
-- ────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prenom TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS langue TEXT NOT NULL DEFAULT 'fr';

-- Valeurs posées AVANT la contrainte : relancé alors qu'un profil porte encore
-- l'ancienne valeur 'ca', le script ne doit pas échouer.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_langue_valide;

UPDATE profiles SET prenom = 'Moti', langue = 'fr'
  WHERE id = (SELECT id FROM auth.users WHERE email = '1@power.app');
UPDATE profiles SET prenom = 'Yamina', langue = 'es'
  WHERE id = (SELECT id FROM auth.users WHERE email = '2@power.app');

ALTER TABLE profiles
  ADD CONSTRAINT profiles_langue_valide
  CHECK (langue IN ('fr', 'es'));


-- ────────────────────────────────────────────────────────────
-- 2. SEANCES_PAS — passage au même modèle que les autres tables
--
-- Les 41 lignes existantes viennent toutes du raccourci iPhone du
-- compte 1 : on les lui attribue explicitement.
-- ────────────────────────────────────────────────────────────

-- Relançable après déploiement : entre-temps, l'ancien code a pu écrire des
-- jours sous l'ancien identifiant ET le nouveau code le même jour sous '1'.
-- La contrainte UNIQUE (user_id, date) ferait alors échouer un simple UPDATE,
-- et tout le script avec. On fusionne d'abord ces doublons en gardant le plus
-- grand nombre de pas, puis on rattache le reste.
UPDATE seances_pas AS compte
SET pas = GREATEST(compte.pas, orphelin.pas)
FROM seances_pas AS orphelin
WHERE compte.user_id = '1'
  AND orphelin.user_id NOT IN ('1', '2')
  AND orphelin.date = compte.date;

DELETE FROM seances_pas AS orphelin
WHERE orphelin.user_id NOT IN ('1', '2')
  AND EXISTS (
    SELECT 1 FROM seances_pas AS compte
    WHERE compte.user_id = '1' AND compte.date = orphelin.date
  );

UPDATE seances_pas SET user_id = '1' WHERE user_id NOT IN ('1', '2');

ALTER TABLE seances_pas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecture_pas_authentifies" ON seances_pas;
DROP POLICY IF EXISTS "seances_pas_select" ON seances_pas;
DROP POLICY IF EXISTS "seances_pas_insert" ON seances_pas;
DROP POLICY IF EXISTS "seances_pas_update" ON seances_pas;
DROP POLICY IF EXISTS "seances_pas_delete" ON seances_pas;

CREATE POLICY "seances_pas_select" ON seances_pas FOR SELECT TO authenticated
  USING ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "seances_pas_insert" ON seances_pas FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "seances_pas_update" ON seances_pas FOR UPDATE TO authenticated
  USING ((SELECT public.compte_courant()) = user_id)
  WITH CHECK ((SELECT public.compte_courant()) = user_id);
CREATE POLICY "seances_pas_delete" ON seances_pas FOR DELETE TO authenticated
  USING ((SELECT public.compte_courant()) = user_id);

REVOKE ALL ON seances_pas FROM anon;


-- ============================================================
-- VÉRIFICATION — à lancer juste après.
-- Attendu : seances_pas entièrement sur '1', et les deux profils
-- renseignés avec leur prénom et leur langue.
-- ============================================================
SELECT user_id, count(*) AS lignes FROM seances_pas GROUP BY user_id ORDER BY user_id;

SELECT u.email, p.prenom, p.langue, p.theme, p.mode
FROM profiles p JOIN auth.users u ON u.id = p.id
ORDER BY u.email;
