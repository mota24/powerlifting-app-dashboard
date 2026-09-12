-- Requiert public.compte_courant() : lancer d'abord migration_securite_comptes.sql.
-- ============================================================
-- CLASSEMENT — règles de calcul corrigées
-- À coller dans Supabase > SQL Editor.
--
-- Le calcul précédent donnait 65 points partout alors qu'un compte avait
-- validé 3 séances dans la semaine et l'autre 1. Trois corrections :
--
--   1. « Séance validée » ne dépend plus de ce qu'il reste dans la grille :
--      la validation du jour fait foi. Une séance validée puis vidée ou
--      remaniée comptait zéro.
--   2. L'objectif de la semaine devient FIXE : 3 séances validées. L'ancien
--      barème exigeait « toutes les séances prévues » : propager un bloc sur
--      4 semaines créait 4 jours prévus, donc un objectif inatteignable,
--      pendant qu'un compte sans plan avait un objectif de 1 séance.
--   3. Un jour de repos validé ne casse plus la série de la semaine, comme
--      dans la série affichée par l'app.
--
-- Barème inchangé : 10 points par jour à 8 000 pas, 20 par séance validée,
-- 30 pour l'objectif de la semaine, 5 par jour de série (35 au plus).
-- Idempotent : relançable sans risque. Ne modifie aucune donnée.
-- ============================================================

CREATE OR REPLACE FUNCTION public.classement_semaines(p_nb integer DEFAULT 1)
RETURNS TABLE (
  semaine          date,
  prenom           text,
  est_moi          boolean,
  points           integer,
  pts_pas          integer,
  pts_seances      integer,
  pts_objectif     integer,
  pts_serie        integer,
  jours_8000       integer,
  seances          integer,
  objectif_fait    integer,
  objectif_seances integer,
  objectif_atteint boolean,
  serie            integer,
  niveau           integer,
  streak           integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
-- search_path figé : une fonction SECURITY DEFINER s'exécute avec les
-- droits de son propriétaire, elle ne doit pas résoudre un nom de table
-- dans un schéma choisi par l'appelant.
SET search_path = public, pg_temp
AS $$
  WITH claims AS (
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb AS c
  ),
  moi AS (
    SELECT public.compte_courant() AS user_id
  ),
  semaines AS (
    SELECT s.debut
    FROM (
      SELECT (date_trunc('week', now() AT TIME ZONE 'Europe/Paris')::date - 7 * g) AS debut
      FROM generate_series(0, least(greatest(coalesce(p_nb, 1), 1), 12) - 1) AS g
    ) s
    WHERE s.debut >= DATE '2026-09-07'
  ),
  bornes AS (
    SELECT min(debut) AS premier_jour, max(debut) + 6 AS dernier_jour FROM semaines
  ),
  joueurs AS (
    SELECT split_part(u.email, '@', 1) AS user_id, p.prenom
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.prenom IS NOT NULL
      AND lower(u.email) ~ '^[a-z0-9_-]{1,64}@power\.app$'
  ),
  jours AS (
    SELECT s.debut, j.user_id, j.prenom, s.debut + d AS jour
    FROM semaines s
    CROSS JOIN joueurs j
    CROSS JOIN generate_series(0, 6) AS d
  ),
  -- Pas du jour : ceux du raccourci téléphone, ou ceux saisis dans la séance.
  pas_synchro AS (
    SELECT sp.user_id, sp.date AS jour, max(sp.pas) AS pas
    FROM public.seances_pas sp, bornes b
    WHERE sp.date BETWEEN b.premier_jour AND b.dernier_jour
    GROUP BY sp.user_id, sp.date
  ),
  pas_saisis AS (
    SELECT w.user_id, w.date AS jour, max(coalesce(w.steps_count, 0)) AS pas
    FROM public.workout_sets w, bornes b
    WHERE w.date BETWEEN b.premier_jour AND b.dernier_jour
    GROUP BY w.user_id, w.date
  ),
  -- La validation du jour fait foi : c'est le geste volontaire de l'athlète.
  -- On ne rejuge pas après coup le contenu de la grille, qui peut être vidé
  -- ou remanié plus tard.
  validations AS (
    SELECT v.user_id, v.date AS jour, bool_or(v.type = 'seance') AS seance
    FROM public.validations_seance v, bornes b
    WHERE v.date BETWEEN b.premier_jour AND b.dernier_jour
    GROUP BY v.user_id, v.date
  ),
  detail AS (
    SELECT
      jr.debut,
      jr.user_id,
      jr.prenom,
      jr.jour,
      greatest(coalesce(ps.pas, 0), coalesce(pw.pas, 0)) AS pas,
      coalesce(v.seance, false) AS seance_validee,
      (v.jour IS NOT NULL) AS jour_valide
    FROM jours jr
    LEFT JOIN pas_synchro ps ON ps.user_id = jr.user_id AND ps.jour = jr.jour
    LEFT JOIN pas_saisis pw ON pw.user_id = jr.user_id AND pw.jour = jr.jour
    LEFT JOIN validations v ON v.user_id = jr.user_id AND v.jour = jr.jour
  ),
  -- Série : jours actifs consécutifs. Un jour de repos validé compte, comme
  -- dans la série de l'app. Soustraire le rang à la date donne la même valeur
  -- à tous les jours d'une même suite ininterrompue.
  ilots AS (
    SELECT
      dt.debut,
      dt.user_id,
      dt.jour - (row_number() OVER (PARTITION BY dt.debut, dt.user_id ORDER BY dt.jour))::integer AS ilot
    FROM detail dt
    WHERE dt.jour_valide OR dt.pas >= 8000
  ),
  series AS (
    SELECT x.debut, x.user_id, max(x.longueur)::integer AS plus_longue
    FROM (
      SELECT i.debut, i.user_id, i.ilot, count(*) AS longueur
      FROM ilots i
      GROUP BY i.debut, i.user_id, i.ilot
    ) x
    GROUP BY x.debut, x.user_id
  ),
  totaux AS (
    SELECT
      dt.debut,
      dt.user_id,
      dt.prenom,
      count(*) FILTER (WHERE dt.pas >= 8000)::integer AS nb_8000,
      count(*) FILTER (WHERE dt.seance_validee)::integer AS nb_seances
    FROM detail dt
    GROUP BY dt.debut, dt.user_id, dt.prenom
  ),
  scores AS (
    SELECT
      t.debut,
      t.user_id,
      t.prenom,
      t.nb_8000,
      t.nb_seances,
      coalesce(s.plus_longue, 0) AS nb_serie,
      -- Objectif FIXE : le même pour tout le monde. L'ancien barème comptait
      -- « toutes les séances prévues », donc planifier son bloc à l'avance
      -- rendait l'objectif inatteignable.
      3 AS obj_cible
    FROM totaux t
    LEFT JOIN series s ON s.debut = t.debut AND s.user_id = t.user_id
  )
  SELECT
    sc.debut,
    sc.prenom,
    sc.user_id = (SELECT user_id FROM moi),
    (sc.nb_8000 * 10 + sc.nb_seances * 20 + CASE WHEN sc.nb_seances >= sc.obj_cible THEN 30 ELSE 0 END + least(sc.nb_serie, 7) * 5)::integer,
    (sc.nb_8000 * 10)::integer,
    (sc.nb_seances * 20)::integer,
    (CASE WHEN sc.nb_seances >= sc.obj_cible THEN 30 ELSE 0 END)::integer,
    (least(sc.nb_serie, 7) * 5)::integer,
    sc.nb_8000,
    sc.nb_seances,
    least(sc.nb_seances, sc.obj_cible)::integer,
    sc.obj_cible::integer,
    sc.nb_seances >= sc.obj_cible,
    sc.nb_serie::integer,
    coalesce(up.level, 1),
    coalesce(up.streak_days, 0)
  FROM scores sc
  LEFT JOIN public.user_progress up ON up.user_id = sc.user_id
  -- Réservé aux joueurs : un compte hors de l'app ne reçoit rien. Le
  -- service_role (serveur uniquement) reste autorisé pour les vérifications.
  WHERE EXISTS (SELECT 1 FROM joueurs j, moi m WHERE j.user_id = m.user_id)
     OR (SELECT c ->> 'role' FROM claims) = 'service_role'
  ORDER BY sc.debut DESC, 4 DESC;
$$;

REVOKE ALL ON FUNCTION public.classement_semaines(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.classement_semaines(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.classement_semaines(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classement_semaines(integer) TO service_role;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VÉRIFICATION — une ligne par joueur pour la semaine en cours.
-- Attendu : le compte qui a validé le plus de séances mène, et
-- points = pts_pas + pts_seances + pts_objectif + pts_serie.
-- ============================================================
SELECT prenom, points, pts_pas, pts_seances, pts_objectif, pts_serie,
       jours_8000, seances, objectif_fait, objectif_seances, serie
FROM public.classement_semaines(1)
ORDER BY points DESC;
