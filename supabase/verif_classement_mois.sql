-- ============================================================
-- VÉRIFICATION DU CLASSEMENT AU MOIS — à coller dans Supabase > SQL Editor.
--
-- Simple SELECT : ne crée rien, ne modifie rien, ne touche aucune donnée.
--
-- Pourquoi : le vrai comptage démarre le 14/09/2026, donc aujourd'hui la
-- fonction renvoie 0 pour tout le monde — normal, mais impossible de
-- contrôler les calculs. Cette requête rejoue EXACTEMENT le même pipeline
-- en faisant comme si le comptage avait démarré le 01/09, pour voir les
-- points tomber sur des données réelles.
--
-- À lire dans le résultat :
--   points = pts_pas + pts_seances + pts_objectif + pts_serie
--   jours_8000 × 10 = pts_pas, seances × 20 = pts_seances,
--   objectif_fait × 30 = pts_objectif, min(serie, 7) × 5 = pts_serie
-- ============================================================

WITH aujourdhui AS (
  SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS jour
),
-- Seule différence avec la fonction : le premier jour compté.
depart AS (
  SELECT DATE '2026-09-01' AS jour
),
mois_comptes AS (
  SELECT
    date_trunc('month', (SELECT jour FROM aujourdhui))::date AS debut,
    greatest(date_trunc('month', (SELECT jour FROM aujourdhui))::date, (SELECT jour FROM depart)) AS depuis,
    least((date_trunc('month', (SELECT jour FROM aujourdhui))::date + interval '1 month' - interval '1 day')::date,
          (SELECT jour FROM aujourdhui)) AS jusqua
),
joueurs AS (
  SELECT split_part(u.email, '@', 1) AS user_id, p.prenom
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.prenom IS NOT NULL
    AND lower(u.email) ~ '^[a-z0-9_-]{1,64}@power\.app$'
),
paires AS (
  SELECT mc.debut, j.user_id, j.prenom
  FROM mois_comptes mc
  CROSS JOIN joueurs j
),
bornes AS (
  SELECT min(mc.depuis) AS premier_jour, max(mc.jusqua) AS dernier_jour FROM mois_comptes mc
),
jours AS (
  SELECT b.debut, j.user_id, j.prenom, d::date AS jour
  FROM mois_comptes b
  CROSS JOIN joueurs j
  CROSS JOIN LATERAL generate_series(b.depuis::timestamp, b.jusqua::timestamp, interval '1 day') AS d
),
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
validations AS (
  SELECT v.user_id, v.date AS jour, bool_or(v.type = 'seance') AS seance
  FROM public.validations_seance v, bornes b
  WHERE v.date BETWEEN b.premier_jour AND b.dernier_jour
  GROUP BY v.user_id, v.date
),
prevus AS (
  SELECT w.user_id, w.date AS jour
  FROM public.workout_sets w, bornes b
  WHERE w.date BETWEEN b.premier_jour AND b.dernier_jour
    AND coalesce(w.exercise_name, '') NOT IN ('Repos', 'Jour de Repos')
    AND (
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.coach_tracking_data) = 'array' THEN w.coach_tracking_data ELSE '[]'::jsonb END) AS e
        WHERE coalesce(e ->> 'reps', '') ~ '[1-9]' OR coalesce(e ->> 'weight', '') ~ '[1-9]'
      )
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.tracking_data) = 'array' THEN w.tracking_data ELSE '[]'::jsonb END) AS e
        WHERE coalesce(e ->> 'reps', '') ~ '[1-9]' OR coalesce(e ->> 'weight', '') ~ '[1-9]'
      )
    )
  GROUP BY w.user_id, w.date
),
detail AS (
  SELECT
    jr.debut, jr.user_id, jr.prenom, jr.jour,
    greatest(coalesce(ps.pas, 0), coalesce(pw.pas, 0)) AS pas,
    coalesce(v.seance, false) AS seance_validee,
    (v.jour IS NOT NULL) AS jour_valide,
    (pr.jour IS NOT NULL) AS prevu
  FROM jours jr
  LEFT JOIN pas_synchro ps ON ps.user_id = jr.user_id AND ps.jour = jr.jour
  LEFT JOIN pas_saisis pw ON pw.user_id = jr.user_id AND pw.jour = jr.jour
  LEFT JOIN validations v ON v.user_id = jr.user_id AND v.jour = jr.jour
  LEFT JOIN prevus pr ON pr.user_id = jr.user_id AND pr.jour = jr.jour
),
ilots AS (
  SELECT
    dt.debut, dt.user_id,
    dt.jour - (row_number() OVER (PARTITION BY dt.debut, dt.user_id ORDER BY dt.jour))::integer AS ilot
  FROM detail dt
  WHERE dt.jour_valide OR dt.pas >= 8000 OR NOT dt.prevu
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
semaines AS (
  SELECT dt.debut, dt.user_id, date_trunc('week', dt.jour)::date AS semaine,
         count(*) FILTER (WHERE dt.seance_validee)::integer AS seances
  FROM detail dt
  GROUP BY dt.debut, dt.user_id, date_trunc('week', dt.jour)::date
),
objectifs AS (
  SELECT sm.debut, sm.user_id,
         count(*)::integer AS semaines_comptees,
         count(*) FILTER (WHERE sm.seances >= 3)::integer AS semaines_reussies
  FROM semaines sm
  GROUP BY sm.debut, sm.user_id
),
totaux AS (
  SELECT pa.debut, pa.prenom, pa.user_id,
         count(dt.jour) FILTER (WHERE dt.pas >= 8000)::integer AS nb_8000,
         count(dt.jour) FILTER (WHERE dt.seance_validee)::integer AS nb_seances
  FROM paires pa
  LEFT JOIN detail dt ON dt.debut = pa.debut AND dt.user_id = pa.user_id
  GROUP BY pa.debut, pa.prenom, pa.user_id
)
SELECT
  t.prenom,
  (t.nb_8000 * 10 + t.nb_seances * 20 + coalesce(o.semaines_reussies, 0) * 30
     + least(coalesce(s.plus_longue, 0), 7) * 5) AS points,
  t.nb_8000 * 10                                  AS pts_pas,
  t.nb_seances * 20                               AS pts_seances,
  coalesce(o.semaines_reussies, 0) * 30           AS pts_objectif,
  least(coalesce(s.plus_longue, 0), 7) * 5        AS pts_serie,
  t.nb_8000                                       AS jours_8000,
  t.nb_seances                                    AS seances,
  coalesce(o.semaines_reussies, 0)                AS objectif_fait,
  coalesce(o.semaines_comptees, 0)                AS objectif_semaines,
  coalesce(s.plus_longue, 0)                      AS serie
FROM totaux t
LEFT JOIN series s ON s.debut = t.debut AND s.user_id = t.user_id
LEFT JOIN objectifs o ON o.debut = t.debut AND o.user_id = t.user_id
ORDER BY 2 DESC;
