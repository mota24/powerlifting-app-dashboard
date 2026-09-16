-- Requiert migration_repos_actif.sql (les fonctions reprennent ses colonnes).
-- ============================================================
-- RECORD BATTU — +15 points pour une séance validée qui bat un record
-- À coller dans Supabase > SQL Editor.
--
-- L'app compare, au moment de « Terminer la séance », le meilleur 1RM estimé
-- du jour (squat / bench / deadlift, ou squat / hip thrust / RDL en fitness)
-- aux 12 mois de séances précédentes. S'il est battu, la validation du jour
-- porte record = true. Un mouvement noté pour la première fois ne compte pas.
--
-- La base garantit ce qu'elle peut vérifier seule : une validation par jour,
-- le jour même, pour son propre compte, et un record seulement sur une
-- séance (jamais sur un repos). Le calcul du 1RM, lui, se fait dans l'app.
--
-- Les deux fonctions de classement sont recréées (deux colonnes de plus),
-- d'où le DROP. Le reste du barème ne bouge pas.
-- Idempotent : relançable sans risque. Ne modifie aucune donnée existante.
-- ============================================================

ALTER TABLE public.validations_seance
  ADD COLUMN IF NOT EXISTS record boolean NOT NULL DEFAULT false;

ALTER TABLE public.validations_seance
  DROP CONSTRAINT IF EXISTS validations_seance_record_seance;
ALTER TABLE public.validations_seance
  ADD CONSTRAINT validations_seance_record_seance CHECK (NOT record OR type = 'seance');

DROP FUNCTION IF EXISTS public.classement_mois(integer);

CREATE OR REPLACE FUNCTION public.classement_mois(p_nb integer DEFAULT 1)
RETURNS TABLE (
  mois              date,
  depuis            date,
  prenom            text,
  est_moi           boolean,
  points            integer,
  pts_pas           integer,
  pts_seances       integer,
  pts_objectif      integer,
  pts_serie         integer,
  jours_8000        integer,
  seances           integer,
  objectif_fait     integer,
  objectif_semaines integer,
  objectif_atteint  boolean,
  serie             integer,
  niveau            integer,
  streak            integer,
  pts_eau           integer,
  jours_eau         integer,
  pts_repos         integer,
  jours_repos       integer,
  pts_record        integer,
  jours_record      integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
-- search_path figé : une fonction SECURITY DEFINER s'exécute avec les droits
-- de son propriétaire, elle ne doit pas résoudre un nom de table dans un
-- schéma choisi par l'appelant.
SET search_path = public, pg_temp
AS $$
  WITH claims AS (
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb AS c
  ),
  moi AS (
    SELECT public.compte_courant() AS user_id
  ),
  aujourdhui AS (
    SELECT (now() AT TIME ZONE 'Europe/Paris')::date AS jour
  ),
  -- Premier jour compté, tous mois confondus.
  depart AS (
    SELECT DATE '2026-09-14' AS jour
  ),
  mois_demandes AS (
    SELECT (date_trunc('month', (SELECT jour FROM aujourdhui))::date - (g * interval '1 month'))::date AS debut
    FROM generate_series(0, least(greatest(coalesce(p_nb, 1), 1), 12) - 1) AS g
  ),
  -- Un mois en cours s'arrête aujourd'hui : les jours à venir ne comptent pas.
  mois_comptes AS (
    SELECT
      m.debut,
      greatest(m.debut, (SELECT jour FROM depart)) AS depuis,
      least((m.debut + interval '1 month' - interval '1 day')::date, (SELECT jour FROM aujourdhui)) AS jusqua
    FROM mois_demandes m
  ),
  -- Références qualifiées : « depuis » est aussi une colonne de sortie de la
  -- fonction, une référence nue serait ambiguë.
  mois_valides AS (
    SELECT mc.*
    FROM mois_comptes mc
    WHERE mc.depuis <= mc.jusqua
       -- Le mois en cours reste affiché même avant le premier jour compté :
       -- tout le monde y est à zéro, ce qui vaut mieux qu'un écran d'erreur.
       OR mc.debut = date_trunc('month', (SELECT jour FROM aujourdhui))::date
  ),
  joueurs AS (
    SELECT split_part(u.email, '@', 1) AS user_id, p.prenom
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.prenom IS NOT NULL
      AND lower(u.email) ~ '^[a-z0-9_-]{1,64}@power\.app$'
  ),
  -- Une ligne par mois et par joueur, même sans un seul jour compté.
  paires AS (
    SELECT mv.debut, j.user_id, j.prenom
    FROM mois_valides mv
    CROSS JOIN joueurs j
  ),
  bornes AS (
    SELECT min(mv.depuis) AS premier_jour, max(mv.jusqua) AS dernier_jour FROM mois_valides mv
  ),
  jours AS (
    SELECT b.debut, b.depuis, j.user_id, j.prenom, d::date AS jour
    FROM mois_valides b
    CROSS JOIN joueurs j
    CROSS JOIN LATERAL generate_series(b.depuis::timestamp, b.jusqua::timestamp, interval '1 day') AS d
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
  validations AS (
    SELECT v.user_id, v.date AS jour, bool_or(v.type = 'seance') AS seance,
      bool_or(v.type = 'seance' AND v.record) AS record
    FROM public.validations_seance v, bornes b
    WHERE v.date BETWEEN b.premier_jour AND b.dernier_jour
    GROUP BY v.user_id, v.date
  ),
  -- Eau bue dans la journee, en millilitres : une ligne par jour.
  eau AS (
    SELECT e.user_id, e.date AS jour, max(e.ml) AS ml
    FROM public.journal_eau e, bornes b
    WHERE e.date BETWEEN b.premier_jour AND b.dernier_jour
    GROUP BY e.user_id, e.date
  ),
  -- Jour de repos actif : la ligne « Jour de Repos » porte une activite
  -- (mobilite ou cardio) d'au moins 10 minutes, rangee comme un cardio de
  -- seance : le type dans « weight », les minutes dans « reps ».
  repos_actifs AS (
    SELECT w.user_id, w.date AS jour
    FROM public.workout_sets w, bornes b
    WHERE w.date BETWEEN b.premier_jour AND b.dernier_jour
      AND coalesce(w.exercise_name, '') IN ('Repos', 'Jour de Repos')
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.tracking_data) = 'array' THEN w.tracking_data ELSE '[]'::jsonb END) AS e
        WHERE coalesce(e ->> 'weight', '') <> ''
          AND coalesce(nullif(regexp_replace(coalesce(e ->> 'reps', ''), '[^0-9]', '', 'g'), ''), '0')::integer >= 10
      )
    GROUP BY w.user_id, w.date
  ),
  detail AS (
    SELECT
      jr.debut,
      jr.user_id,
      jr.prenom,
      jr.jour,
      greatest(coalesce(ps.pas, 0), coalesce(pw.pas, 0)) AS pas,
      coalesce(v.seance, false) AS seance_validee,
      (v.jour IS NOT NULL) AS jour_valide,
      coalesce(v.record, false) AS record_battu,
      coalesce(ea.ml, 0) AS eau,
      (ra.jour IS NOT NULL) AS repos_actif
    FROM jours jr
    LEFT JOIN pas_synchro ps ON ps.user_id = jr.user_id AND ps.jour = jr.jour
    LEFT JOIN pas_saisis pw ON pw.user_id = jr.user_id AND pw.jour = jr.jour
    LEFT JOIN validations v ON v.user_id = jr.user_id AND v.jour = jr.jour
    LEFT JOIN eau ea ON ea.user_id = jr.user_id AND ea.jour = jr.jour
    LEFT JOIN repos_actifs ra ON ra.user_id = jr.user_id AND ra.jour = jr.jour
  ),
  -- Série : jours actifs consécutifs. Un jour non validé la coupe, qu'une
  -- séance ait été prévue ou non. Soustraire le rang à la date donne la même
  -- valeur à tous les jours d'une même suite ininterrompue.
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
  -- Objectif : 3 séances validées dans une semaine, +30 pour chaque semaine
  -- réussie du mois. Une semaine à cheval sur deux mois n'est comptée, de
  -- chaque côté, qu'avec ses jours du mois.
  semaines AS (
    SELECT
      dt.debut,
      dt.user_id,
      date_trunc('week', dt.jour)::date AS semaine,
      count(*) FILTER (WHERE dt.seance_validee)::integer AS seances
    FROM detail dt
    GROUP BY dt.debut, dt.user_id, date_trunc('week', dt.jour)::date
  ),
  objectifs AS (
    SELECT
      sm.debut,
      sm.user_id,
      count(*)::integer AS semaines_comptees,
      count(*) FILTER (WHERE sm.seances >= 3)::integer AS semaines_reussies
    FROM semaines sm
    GROUP BY sm.debut, sm.user_id
  ),
  totaux AS (
    SELECT
      pa.debut,
      pa.user_id,
      pa.prenom,
      count(dt.jour) FILTER (WHERE dt.pas >= 8000)::integer AS nb_8000,
      count(dt.jour) FILTER (WHERE dt.seance_validee)::integer AS nb_seances,
      count(dt.jour) FILTER (WHERE dt.eau >= 2000)::integer AS nb_eau,
      count(dt.jour) FILTER (WHERE dt.repos_actif AND dt.jour_valide)::integer AS nb_repos,
      count(dt.jour) FILTER (WHERE dt.record_battu)::integer AS nb_records
    FROM paires pa
    LEFT JOIN detail dt ON dt.debut = pa.debut AND dt.user_id = pa.user_id
    GROUP BY pa.debut, pa.user_id, pa.prenom
  ),
  scores AS (
    SELECT
      t.debut,
      t.user_id,
      t.prenom,
      t.nb_8000,
      t.nb_seances,
      t.nb_eau,
      t.nb_repos,
      t.nb_records,
      coalesce(s.plus_longue, 0) AS nb_serie,
      coalesce(o.semaines_reussies, 0) AS obj_ok,
      coalesce(o.semaines_comptees, 0) AS obj_total
    FROM totaux t
    LEFT JOIN series s ON s.debut = t.debut AND s.user_id = t.user_id
    LEFT JOIN objectifs o ON o.debut = t.debut AND o.user_id = t.user_id
  )
  SELECT
    sc.debut,
    (SELECT mv.depuis FROM mois_valides mv WHERE mv.debut = sc.debut),
    sc.prenom,
    sc.user_id = (SELECT user_id FROM moi),
    (sc.nb_8000 * 10 + sc.nb_eau * 10 + sc.nb_repos * 10 + sc.nb_records * 15 + sc.nb_seances * 20 + sc.obj_ok * 30 + least(sc.nb_serie, 7) * 5)::integer,
    (sc.nb_8000 * 10)::integer,
    (sc.nb_seances * 20)::integer,
    (sc.obj_ok * 30)::integer,
    (least(sc.nb_serie, 7) * 5)::integer,
    sc.nb_8000,
    sc.nb_seances,
    sc.obj_ok,
    sc.obj_total,
    sc.obj_ok > 0 AND sc.obj_ok = sc.obj_total,
    sc.nb_serie::integer,
    coalesce(up.level, 1),
    coalesce(up.streak_days, 0),
    (sc.nb_eau * 10)::integer,
    sc.nb_eau,
    (sc.nb_repos * 10)::integer,
    sc.nb_repos,
    (sc.nb_records * 15)::integer,
    sc.nb_records
  FROM scores sc
  LEFT JOIN public.user_progress up ON up.user_id = sc.user_id
  -- Réservé aux joueurs : un compte hors de l'app ne reçoit rien. Le
  -- service_role (serveur uniquement) reste autorisé pour les vérifications.
  WHERE EXISTS (SELECT 1 FROM joueurs j, moi m WHERE j.user_id = m.user_id)
     OR (SELECT c ->> 'role' FROM claims) = 'service_role'
  ORDER BY sc.debut DESC, 5 DESC;
$$;

REVOKE ALL ON FUNCTION public.classement_mois(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.classement_mois(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.classement_mois(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classement_mois(integer) TO service_role;

DROP FUNCTION IF EXISTS public.classement_semaines(integer);

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
  streak           integer,
  pts_eau           integer,
  jours_eau         integer,
  pts_repos         integer,
  jours_repos       integer,
  pts_record        integer,
  jours_record      integer
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
    SELECT v.user_id, v.date AS jour, bool_or(v.type = 'seance') AS seance,
      bool_or(v.type = 'seance' AND v.record) AS record
    FROM public.validations_seance v, bornes b
    WHERE v.date BETWEEN b.premier_jour AND b.dernier_jour
    GROUP BY v.user_id, v.date
  ),
  -- Eau bue dans la journee, en millilitres : une ligne par jour.
  eau AS (
    SELECT e.user_id, e.date AS jour, max(e.ml) AS ml
    FROM public.journal_eau e, bornes b
    WHERE e.date BETWEEN b.premier_jour AND b.dernier_jour
    GROUP BY e.user_id, e.date
  ),
  -- Jour de repos actif : la ligne « Jour de Repos » porte une activite
  -- (mobilite ou cardio) d'au moins 10 minutes, rangee comme un cardio de
  -- seance : le type dans « weight », les minutes dans « reps ».
  repos_actifs AS (
    SELECT w.user_id, w.date AS jour
    FROM public.workout_sets w, bornes b
    WHERE w.date BETWEEN b.premier_jour AND b.dernier_jour
      AND coalesce(w.exercise_name, '') IN ('Repos', 'Jour de Repos')
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.tracking_data) = 'array' THEN w.tracking_data ELSE '[]'::jsonb END) AS e
        WHERE coalesce(e ->> 'weight', '') <> ''
          AND coalesce(nullif(regexp_replace(coalesce(e ->> 'reps', ''), '[^0-9]', '', 'g'), ''), '0')::integer >= 10
      )
    GROUP BY w.user_id, w.date
  ),
  detail AS (
    SELECT
      jr.debut,
      jr.user_id,
      jr.prenom,
      jr.jour,
      greatest(coalesce(ps.pas, 0), coalesce(pw.pas, 0)) AS pas,
      coalesce(v.seance, false) AS seance_validee,
      (v.jour IS NOT NULL) AS jour_valide,
      coalesce(v.record, false) AS record_battu,
      coalesce(ea.ml, 0) AS eau,
      (ra.jour IS NOT NULL) AS repos_actif
    FROM jours jr
    LEFT JOIN pas_synchro ps ON ps.user_id = jr.user_id AND ps.jour = jr.jour
    LEFT JOIN pas_saisis pw ON pw.user_id = jr.user_id AND pw.jour = jr.jour
    LEFT JOIN validations v ON v.user_id = jr.user_id AND v.jour = jr.jour
    LEFT JOIN eau ea ON ea.user_id = jr.user_id AND ea.jour = jr.jour
    LEFT JOIN repos_actifs ra ON ra.user_id = jr.user_id AND ra.jour = jr.jour
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
      count(*) FILTER (WHERE dt.seance_validee)::integer AS nb_seances,
      count(*) FILTER (WHERE dt.eau >= 2000)::integer AS nb_eau,
      count(*) FILTER (WHERE dt.repos_actif AND dt.jour_valide)::integer AS nb_repos,
      count(*) FILTER (WHERE dt.record_battu)::integer AS nb_records
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
      t.nb_eau,
      t.nb_repos,
      t.nb_records,
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
    (sc.nb_8000 * 10 + sc.nb_eau * 10 + sc.nb_repos * 10 + sc.nb_records * 15 + sc.nb_seances * 20 + CASE WHEN sc.nb_seances >= sc.obj_cible THEN 30 ELSE 0 END + least(sc.nb_serie, 7) * 5)::integer,
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
    coalesce(up.streak_days, 0),
    (sc.nb_eau * 10)::integer,
    sc.nb_eau,
    (sc.nb_repos * 10)::integer,
    sc.nb_repos,
    (sc.nb_records * 15)::integer,
    sc.nb_records
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
-- VÉRIFICATION — une seule ligne.
-- Attendu : colonne_record = true, fonctions_avec_record = 2.
-- ============================================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'validations_seance' AND column_name = 'record') AS colonne_record,
  (SELECT count(*) FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('classement_mois', 'classement_semaines')
       AND 'pts_record' = ANY (p.proargnames)) AS fonctions_avec_record;
