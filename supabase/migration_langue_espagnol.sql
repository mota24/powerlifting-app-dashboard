-- ============================================================
-- LANGUE — le compte 2 passe du catalan à l'espagnol
-- À coller dans Supabase > SQL Editor, après le déploiement.
--
-- Le code lit déjà l'ancienne valeur 'ca' comme de l'espagnol : l'ordre
-- déploiement / script ne change rien à l'affichage. Ce script fait le ménage
-- dans les données du compte en mode fitness :
--   1. profiles.langue 'ca' -> 'es', et la contrainte n'accepte plus 'ca' ;
--   2. noms d'exercices du catalogue catalan -> leur équivalent espagnol,
--      dans toutes ses séances (passées et futures) ;
--   3. nom par défaut des blocs : 'NOU BLOC' -> 'NUEVO BLOQUE'.
--
-- Seuls les noms EXACTS du catalogue sont renommés. Un nom tapé à la main et
-- les commentaires ne sont pas touchés : la vérification les liste.
-- Aucune donnée du compte 1 n'est concernée (filtre sur le mode fitness).
-- Idempotent : relancé, il ne change plus rien.
-- ============================================================


-- 1. LANGUE DU PROFIL
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_langue_valide;

UPDATE public.profiles SET langue = 'es' WHERE langue = 'ca';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_langue_valide
  CHECK (langue IN ('fr', 'es'));


-- 2. NOMS D'EXERCICES (34 correspondances catalan -> espagnol)
UPDATE public.workout_sets AS w
SET exercise_name = m.es
FROM (VALUES
  ('Pes mort romanès',              'Peso muerto rumano'),
  ('Premsa de cames',               'Prensa de piernas'),
  ('Extensió de quàdriceps',        'Extensión de cuádriceps'),
  ('Gambades amb manuelles',        'Zancadas con mancuernas'),
  ('Squat búlgar',                  'Sentadilla búlgara'),
  ('Abductors a màquina',           'Abductores en máquina'),
  ('Adductors a màquina',           'Aductores en máquina'),
  ('Bessons dempeus',               'Gemelos de pie'),
  ('Pujades a banc',                'Subidas al banco'),
  ('Patada de glutis a politja',    'Patada de glúteo en polea'),
  ('Press de banca amb manuelles',  'Press de banca con mancuernas'),
  ('Press de pit a màquina',        'Press de pecho en máquina'),
  ('Press inclinat amb manuelles',  'Press inclinado con mancuernas'),
  ('Obertures a politja',           'Aperturas en polea'),
  ('Press d''espatlles a màquina',  'Press de hombros en máquina'),
  ('Elevacions laterals',           'Elevaciones laterales'),
  ('Extensió de tríceps a politja', 'Extensión de tríceps en polea'),
  ('Fons assistits',                'Fondos asistidos'),
  ('Jal·lonament al pit',           'Jalón al pecho'),
  ('Rem a màquina',                 'Remo en máquina'),
  ('Rem baix a politja',            'Remo bajo en polea'),
  ('Rem amb manuella',              'Remo con mancuerna'),
  ('Curl de bíceps amb manuelles',  'Curl de bíceps con mancuernas'),
  ('Dominades assistides',          'Dominadas asistidas'),
  ('Planxa',                        'Plancha'),
  ('Crunch a politja',              'Crunch en polea'),
  ('Elevació de cames',             'Elevación de piernas'),
  ('Abdominals a màquina',          'Abdominales en máquina'),
  ('Cinta de córrer',               'Cinta de correr'),
  ('Rem (ergòmetre)',               'Remo (ergómetro)'),
  ('El·líptica',                    'Elíptica'),
  ('Estiraments',                   'Estiramientos'),
  ('Mobilitat de malucs',           'Movilidad de cadera'),
  ('Exercici sense nom',            'Ejercicio sin nombre')
) AS m(ca, es)
WHERE w.exercise_name = m.ca
  AND w.user_id IN (
    SELECT split_part(u.email, '@', 1)
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.mode = 'fitness'
  );


-- 3. NOM PAR DÉFAUT DES BLOCS
UPDATE public.training_blocks AS b
SET name = 'NUEVO BLOQUE'
WHERE b.name = 'NOU BLOC'
  AND b.user_id IN (
    SELECT split_part(u.email, '@', 1)
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.mode = 'fitness'
  );


-- ============================================================
-- VÉRIFICATION (une seule requête : l'éditeur n'affiche que la dernière).
-- Attendu : langue = es pour Yamina, fr pour Moti ; puis les noms d'exercices
-- et de blocs du compte fitness, en espagnol ou tels qu'elle les a tapés.
-- ============================================================
SELECT 'langue' AS verif, coalesce(p.prenom, '?') || ' = ' || p.langue AS valeur, NULL::bigint AS lignes
FROM public.profiles p
UNION ALL
SELECT 'exercice', w.exercise_name, count(*)
FROM public.workout_sets w
WHERE w.user_id IN (
    SELECT split_part(u.email, '@', 1)
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.mode = 'fitness'
  )
GROUP BY w.exercise_name
UNION ALL
SELECT 'bloc', b.name, count(*)
FROM public.training_blocks b
WHERE b.user_id IN (
    SELECT split_part(u.email, '@', 1)
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.mode = 'fitness'
  )
GROUP BY b.name
ORDER BY 1 DESC, 3 DESC NULLS FIRST, 2;
