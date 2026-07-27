-- ============================================================
-- MIGRATION PALMARÈS — LIEN DE LA REDIFFUSION
-- à coller dans Supabase > SQL Editor
-- (à exécuter APRÈS migration_palmares_country.sql)
--
-- Lien vers la vidéo de la compétition (rediffusion YouTube, live, etc.).
-- Idempotente et sans effet sur les lignes existantes (video_url reste
-- NULL → aucun lien affiché).
-- ============================================================

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Seules les URL http(s) sont acceptées. Ce n'est pas cosmétique : la
-- valeur finit dans un href, et un schéma « javascript: » y serait une
-- faille XSS. L'app applique la même règle avant l'affichage.
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_video_url_http;
ALTER TABLE competitions
  ADD CONSTRAINT competitions_video_url_http
  CHECK (video_url IS NULL OR video_url ~* '^https?://');
