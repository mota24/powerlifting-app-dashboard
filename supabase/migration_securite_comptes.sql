-- ============================================================
-- SÉCURITÉ — identité des comptes liée à l'e-mail COMPLET
-- À coller dans Supabase > SQL Editor. PRIORITAIRE.
--
-- Faille corrigée : toutes les policies comparaient user_id au PRÉFIXE de
-- l'e-mail du jeton (« 1 » pour « 1@power.app »). Les inscriptions publiques
-- étant ouvertes avec confirmation automatique, n'importe qui pouvait créer
-- « 1@autre-domaine.com » avec la clé anon (publique) et lire, modifier ou
-- effacer les données du compte 1 — idem pour le compte 2.
--
-- Correctif : une seule fonction, public.compte_courant(), rend l'identifiant
-- du compte UNIQUEMENT pour un e-mail en @power.app (NULL sinon). Toutes les
-- policies et toutes les valeurs par défaut de user_id passent par elle.
-- Les anciennes policies sont supprimées table par table avant recréation :
-- aucune règle oubliée (« USING (true) », préfixe seul) ne peut subsister.
--
-- À faire AUSSI dans le tableau de bord (réglage, pas du SQL) :
--   Authentication > Sign In / Providers > désactiver « Allow new users to sign up ».
--
-- Idempotent : relançable sans risque. Ne modifie aucune donnée existante.
-- Une table absente (migration pas encore lancée) est ignorée sans erreur.
-- ============================================================


-- 1. IDENTITÉ DU COMPTE COURANT
CREATE OR REPLACE FUNCTION public.compte_courant()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE WHEN j.email ~ '^[a-z0-9_-]{1,64}@power\.app$' THEN split_part(j.email, '@', 1) END
  FROM (
    SELECT lower(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email') AS email
  ) AS j
$$;

REVOKE ALL ON FUNCTION public.compte_courant() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compte_courant() TO authenticated, service_role;


-- 2. POLICIES — recréées table par table
DO $$
DECLARE
  t text;
  nom text;
  noms text[];
  moi constant text := '(SELECT public.compte_courant())';
BEGIN
  -- Tables « un compte = ses lignes ».
  FOREACH t IN ARRAY ARRAY[
    'workout_sets', 'training_blocks', 'user_progress', 'bodyweight_logs', 'competitions',
    'journal_alimentaire', 'modeles_seance', 'aliments_perso', 'objectifs_nutrition',
    'seances_pas', 'validations_seance'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    SELECT coalesce(array_agg(policyname), '{}') INTO noms FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    FOREACH nom IN ARRAY noms LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', nom, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT public.compte_courant()', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = %s)', t || '_select', t, moi);

    -- Pas : écrits uniquement par le serveur (raccourci iPhone, clé service_role).
    IF t = 'seances_pas' THEN CONTINUE; END IF;

    -- Validation : seulement le jour même, et jamais modifiée ni effacée.
    IF t = 'validations_seance' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = %s AND date = (now() AT TIME ZONE %L)::date)',
        t || '_insert_jour_meme', t, moi, 'Europe/Paris'
      );
      CONTINUE;
    END IF;

    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = %s)', t || '_insert', t, moi);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id = %s) WITH CHECK (user_id = %s)', t || '_update', t, moi, moi);
    IF t <> 'objectifs_nutrition' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id = %s)', t || '_delete', t, moi);
    END IF;
  END LOOP;

  -- Tables strictement serveur : RLS active, AUCUNE policy.
  FOREACH t IN ARRAY ARRAY['photos_seance', 'auth_failed_attempts'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    SELECT coalesce(array_agg(policyname), '{}') INTO noms FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    FOREACH nom IN ARRAY noms LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', nom, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;

  -- Profils : la ligne dont l'id est l'UUID du compte connecté (jamais usurpable).
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    SELECT coalesce(array_agg(policyname), '{}') INTO noms FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles';
    FOREACH nom IN ARRAY noms LOOP
      EXECUTE format('DROP POLICY %I ON public.profiles', nom);
    END LOOP;
    CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
    CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
      USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
    REVOKE ALL ON public.profiles FROM anon;
  END IF;
END $$;


-- 3. CLASSEMENT — mêmes règles de points, identité et joueurs restreints à @power.app
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
  pas_synchro AS (
    SELECT sp.user_id, sp.date AS jour, max(sp.pas) AS pas
    FROM public.seances_pas sp, bornes b
    WHERE sp.date BETWEEN b.premier_jour AND b.dernier_jour
    GROUP BY sp.user_id, sp.date
  ),
  validations AS (
    SELECT v.user_id, v.date AS jour
    FROM public.validations_seance v, bornes b
    WHERE v.type = 'seance'
      AND v.date BETWEEN b.premier_jour AND b.dernier_jour
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
      bool_or(l.est_seance AND l.a_des_series) AS series_notees,
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
      (coalesce(pj.series_notees, false) AND vs.jour IS NOT NULL) AS realisee,
      coalesce(pj.prevue, false) AS prevue
    FROM jours jr
    LEFT JOIN pas_synchro ps ON ps.user_id = jr.user_id AND ps.jour = jr.jour
    LEFT JOIN par_jour pj ON pj.user_id = jr.user_id AND pj.jour = jr.jour
    LEFT JOIN validations vs ON vs.user_id = jr.user_id AND vs.jour = jr.jour
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
-- VÉRIFICATION — une seule requête. Attendu :
--   * chaque table : rls_active = true, policies_a_risque = 0, anon_peut_lire = false
--     (photos_seance et auth_failed_attempts : 0 policy, c'est voulu) ;
--   * dernière ligne : « COMPTES HORS @power.app : aucun ».
--     Si des e-mails s'affichent, ce sont des inscriptions étrangères :
--     supprime-les dans Authentication > Users.
-- ============================================================
WITH tables_app AS (
  SELECT c.relname AS nom, c.relrowsecurity AS rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
policies AS (
  SELECT
    tablename,
    count(*) AS nb,
    count(*) FILTER (
      WHERE (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%compte_courant%'
        AND (coalesce(qual, '') || coalesce(with_check, '')) NOT LIKE '%auth.uid()%'
    ) AS a_risque
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
)
SELECT
  t.nom AS objet,
  t.rls AS rls_active,
  coalesce(p.nb, 0) AS policies,
  coalesce(p.a_risque, 0) AS policies_a_risque,
  has_table_privilege('anon', format('public.%I', t.nom), 'SELECT') AS anon_peut_lire
FROM tables_app t
LEFT JOIN policies p ON p.tablename = t.nom
UNION ALL
SELECT
  'COMPTES HORS @power.app : ' || coalesce(string_agg(u.email, ', '), 'aucun'),
  NULL,
  count(*),
  NULL,
  NULL
FROM auth.users u
WHERE u.email IS NULL OR lower(u.email) !~ '^[a-z0-9_-]{1,64}@power\.app$'
ORDER BY 1;
