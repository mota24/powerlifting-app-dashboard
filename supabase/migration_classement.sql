-- ============================================================
-- PHASE 3 — Classement hebdomadaire (points + podium du dimanche)
-- À coller dans Supabase > SQL Editor.
--
-- Le problème : le podium doit comparer les deux comptes, alors que les
-- tables sont cloisonnées par RLS (chacun ne voit que ses propres lignes).
-- On ne rouvre PAS les policies. On crée une fonction SECURITY DEFINER qui
-- calcule les scores côté base et ne renvoie QUE des totaux : prénom,
-- points, nombre de jours à 8 000 pas, nombre de séances, série.
-- Aucun exercice, aucune charge, aucun commentaire ne sort de la fonction.
--
-- Barème — source de vérité unique, l'app ne recalcule rien :
--   8 000 pas ou plus dans la journée ............ +10 par jour
--   Séance réalisée (au moins une série notée) .... +20 par jour
--   Toutes les séances prévues faites ............. +30
--       prévue = une prescription existe ce jour-là ; si la semaine
--       n'en contient aucune, l'objectif est 3 séances réalisées
--   Jours actifs d'affilée dans la semaine ........ +5 par jour, max +35
--       actif = séance réalisée OU 8 000 pas
--
-- Semaine = lundi → dimanche, fuseau Europe/Paris.
-- Pas du jour = le plus haut entre la synchro iPhone et la saisie manuelle.
-- Le classement démarre la semaine du lundi 7 septembre 2026 : avant,
-- le compte 2 n'existait pas et perdrait mécaniquement chaque semaine.
--
-- Lecture seule et idempotent : ne modifie aucune donnée.
-- ============================================================


-- DROP explicite : CREATE OR REPLACE refuse de changer la forme du
-- résultat d'une fonction existante.
DROP FUNCTION IF EXISTS public.classement_semaines(integer);

CREATE FUNCTION public.classement_semaines(p_nb integer DEFAULT 1)
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
    SELECT split_part(coalesce((SELECT c ->> 'email' FROM claims), ''), '@', 1) AS user_id
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
  ),
  jours AS (
    SELECT s.debut, j.user_id, j.prenom, s.debut + d AS jour
    FROM semaines s
    CROSS JOIN joueurs j
    CROSS JOIN generate_series(0, 6) AS d
  ),
  pas_synchro AS (
    SELECT sp.user_id, sp.date AS jour, max(sp.pas) AS pas
    FROM public.seances_pas sp, bornes b
    WHERE sp.date BETWEEN b.premier_jour AND b.dernier_jour
    GROUP BY sp.user_id, sp.date
  ),
  lignes AS (
    SELECT
      w.user_id,
      w.date AS jour,
      coalesce(w.steps_count, 0) AS pas_saisis,
      coalesce(w.exercise_name, '') NOT IN ('Repos', 'Jour de Repos') AS est_seance,
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.tracking_data) = 'array' THEN w.tracking_data ELSE '[]'::jsonb END) AS e
        WHERE coalesce(e ->> 'reps', '') ~ '[1-9]' OR coalesce(e ->> 'weight', '') ~ '[1-9]'
      ) AS a_des_series,
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.coach_tracking_data) = 'array' THEN w.coach_tracking_data ELSE '[]'::jsonb END) AS e
        WHERE coalesce(e ->> 'reps', '') ~ '[1-9]' OR coalesce(e ->> 'weight', '') ~ '[1-9]'
      ) AS a_une_prescription
    FROM public.workout_sets w, bornes b
    WHERE w.date BETWEEN b.premier_jour AND b.dernier_jour
  ),
  par_jour AS (
    SELECT
      l.user_id,
      l.jour,
      max(l.pas_saisis) AS pas_saisis,
      bool_or(l.est_seance AND l.a_des_series) AS realisee,
      bool_or(l.est_seance AND l.a_une_prescription) AS prevue
    FROM lignes l
    GROUP BY l.user_id, l.jour
  ),
  detail AS (
    SELECT
      jr.debut,
      jr.user_id,
      jr.prenom,
      jr.jour,
      greatest(coalesce(ps.pas, 0), coalesce(pj.pas_saisis, 0)) AS pas,
      coalesce(pj.realisee, false) AS realisee,
      coalesce(pj.prevue, false) AS prevue
    FROM jours jr
    LEFT JOIN pas_synchro ps ON ps.user_id = jr.user_id AND ps.jour = jr.jour
    LEFT JOIN par_jour pj ON pj.user_id = jr.user_id AND pj.jour = jr.jour
  ),
  -- Série : jours actifs consécutifs. Soustraire le rang à la date donne
  -- la même valeur à tous les jours d'une même suite ininterrompue.
  ilots AS (
    SELECT
      dt.debut,
      dt.user_id,
      dt.jour - (row_number() OVER (PARTITION BY dt.debut, dt.user_id ORDER BY dt.jour))::integer AS ilot
    FROM detail dt
    WHERE dt.realisee OR dt.pas >= 8000
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
      count(*) FILTER (WHERE dt.realisee)::integer AS nb_seances,
      count(*) FILTER (WHERE dt.prevue)::integer AS nb_prevues,
      count(*) FILTER (WHERE dt.prevue AND dt.realisee)::integer AS nb_prevues_faites
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
      CASE WHEN t.nb_prevues > 0 THEN t.nb_prevues_faites ELSE t.nb_seances END AS obj_fait,
      CASE WHEN t.nb_prevues > 0 THEN t.nb_prevues ELSE 3 END AS obj_cible
    FROM totaux t
    LEFT JOIN series s ON s.debut = t.debut AND s.user_id = t.user_id
  )
  SELECT
    sc.debut,
    sc.prenom,
    sc.user_id = (SELECT user_id FROM moi),
    (sc.nb_8000 * 10 + sc.nb_seances * 20 + CASE WHEN sc.obj_fait >= sc.obj_cible THEN 30 ELSE 0 END + least(sc.nb_serie, 7) * 5)::integer,
    (sc.nb_8000 * 10)::integer,
    (sc.nb_seances * 20)::integer,
    (CASE WHEN sc.obj_fait >= sc.obj_cible THEN 30 ELSE 0 END)::integer,
    (least(sc.nb_serie, 7) * 5)::integer,
    sc.nb_8000,
    sc.nb_seances,
    sc.obj_fait::integer,
    sc.obj_cible::integer,
    sc.obj_fait >= sc.obj_cible,
    sc.nb_serie::integer,
    coalesce(up.level, 1),
    coalesce(up.streak_days, 0)
  FROM scores sc
  LEFT JOIN public.user_progress up ON up.user_id = sc.user_id
  -- Réservé aux participants : un compte authentifié qui n'est pas l'un
  -- des deux joueurs ne reçoit rien. Le service_role (serveur uniquement,
  -- déjà tout-puissant) reste autorisé pour les vérifications.
  WHERE EXISTS (SELECT 1 FROM joueurs j, moi m WHERE j.user_id = m.user_id)
     OR (SELECT c ->> 'role' FROM claims) = 'service_role'
  ORDER BY sc.debut DESC, 4 DESC;
$$;

-- Supabase accorde EXECUTE à anon par défaut sur toute nouvelle fonction :
-- on le retire explicitement, un visiteur non connecté n'a rien à lire ici.
REVOKE ALL ON FUNCTION public.classement_semaines(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.classement_semaines(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.classement_semaines(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classement_semaines(integer) TO service_role;


-- ============================================================
-- VÉRIFICATION — le SQL Editor n'a pas de JWT : on simule un appel du
-- compte 1 le temps d'une transaction annulée.
-- Attendu : une ligne par joueur pour la semaine en cours, est_moi = true
-- sur Moti uniquement.
-- ============================================================
BEGIN;
SELECT set_config('request.jwt.claims', '{"email":"1@power.app"}', true);
SELECT semaine, prenom, est_moi, points, pts_pas, pts_seances, pts_objectif, pts_serie, jours_8000, seances, objectif_fait, objectif_seances, serie
FROM public.classement_semaines(2);
ROLLBACK;
