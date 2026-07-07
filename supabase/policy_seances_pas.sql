-- ============================================================
-- POLICY DE LECTURE — seances_pas (optionnel mais recommandé)
-- À exécuter si la carte "Pas" reste vide alors que la table
-- contient bien les données : cela signifie que RLS bloque la
-- lecture côté navigateur (la route serveur, elle, passe par
-- la clé service_role et n'est jamais bloquée).
-- ============================================================

ALTER TABLE seances_pas ENABLE ROW LEVEL SECURITY;

-- Lecture autorisée pour tout utilisateur connecté à l'app.
-- (L'écriture reste réservée au serveur : aucune policy INSERT/UPDATE
-- n'est créée pour le client, seule la route API peut écrire.)
DROP POLICY IF EXISTS "lecture_pas_authentifies" ON seances_pas;
CREATE POLICY "lecture_pas_authentifies"
  ON seances_pas FOR SELECT
  TO authenticated
  USING (true);
