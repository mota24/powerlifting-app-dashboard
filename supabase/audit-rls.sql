-- ============================================================
-- AUDIT RLS — lecture seule, à coller dans Supabase > SQL Editor
-- Ne modifie rien. Sert à vérifier l'état réel avant/après
-- l'application de rls-policies.sql.
-- ============================================================

-- 1. Tables sans RLS activé du tout.
--    Résultat attendu : 0 ligne. Toute table listée ici est un accès
--    total et immédiat pour n'importe qui (clé anon publique comprise).
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;

-- 2. Tables avec RLS activé mais AUCUNE policy.
--    Résultat attendu : 0 ligne. C'est exactement l'incident vécu :
--    RLS actif + zéro policy = tout le monde refusé, y compris le
--    compte légitime (symptôme : 403 en écriture, 406 sur .single(),
--    listes vides en lecture alors que les données existent).
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public' AND p.policyname IS NULL;

-- 3. Toutes les policies existantes, avec leur condition.
--    Sert à repérer les USING (true)/WITH CHECK (true) — pas une
--    erreur en soi si TO authenticated (cf. modèle mono-athlète
--    documenté dans rls-policies.sql), mais à vérifier une par une :
--    un USING (true) combiné à TO public ou TO anon serait, lui,
--    un accès public complet.
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- 4. Policies sur Storage (photos de compétitions).
--    Résultat attendu : une seule policy, SELECT, sans restriction de
--    rôle (lecture publique voulue — les photos s'affichent sans
--    connexion). Si une policy INSERT/UPDATE/DELETE apparaît ici pour
--    anon ou authenticated, c'est une régression : l'upload doit
--    rester exclusivement serveur (service_role, /api/palmares/photo).
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 5. Privilèges bruts (indépendants des policies) pour anon/authenticated.
--    Une REVOKE ALL manquante ici, combinée à un bug de policy, retire
--    la seconde ligne de défense qui a permis de limiter la casse par
--    le passé sur ce projet.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
