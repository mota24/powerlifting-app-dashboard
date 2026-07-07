-- ============================================================
-- RATE LIMITING CONNEXION — à coller dans Supabase > SQL Editor
--
-- Journal des tentatives de connexion échouées, utilisé par
-- lib/server/rate-limit.ts pour bloquer la force brute de façon
-- PARTAGÉE entre toutes les instances serverless (la couche
-- mémoire seule ne voit que sa propre instance).
-- Limites appliquées par l'app : 5 échecs / 15 min par identifiant,
-- 20 échecs / 15 min par adresse IP.
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_failed_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier text NOT NULL,               -- 'id:<identifiant>' ou 'ip:<adresse>'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_failed_attempts_lookup
  ON auth_failed_attempts (identifier, created_at);

-- Table strictement serveur (service_role) : RLS activé sans aucune
-- policy = aucun accès pour anon/authenticated, même en lecture.
ALTER TABLE auth_failed_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_failed_attempts FROM anon, authenticated;
