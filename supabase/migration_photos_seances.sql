-- ============================================================
-- PHOTOS DE SÉANCE — bucket privé + index des photos
-- À coller dans Supabase > SQL Editor AVANT de tester en local.
--
-- Ce sont des photos de corps. Contrairement aux photos de compétition, le
-- bucket est PRIVÉ : aucune URL publique, et aucune policy pour anon ou
-- authenticated, ni sur le bucket ni sur la table. Seule la route serveur
-- /api/photos (clé service_role, après vérification de la session) lit et
-- écrit ; le navigateur n'affiche que des liens signés valables une heure.
--
-- Place : une photo compressée pèse ~150 à 300 Ko, vignette comprise.
-- 1 Go gratuit ≈ 4 000 photos.
--
-- Idempotent : relançable sans risque. Ne modifie aucune donnée existante.
-- ============================================================


-- 1. BUCKET PRIVÉ (1,5 Mo max par fichier, WebP ou JPEG uniquement)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos-seances', 'photos-seances', false, 1500000, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- 2. INDEX DES PHOTOS
CREATE TABLE IF NOT EXISTS public.photos_seance (
  id          uuid PRIMARY KEY,
  user_id     text NOT NULL,
  date        date NOT NULL,
  chemin      text NOT NULL UNIQUE,
  chemin_mini text NOT NULL UNIQUE,
  largeur     integer NOT NULL CHECK (largeur BETWEEN 1 AND 4096),
  hauteur     integer NOT NULL CHECK (hauteur BETWEEN 1 AND 4096),
  octets      integer NOT NULL CHECK (octets > 0),
  cree_le     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_seance_compte_date
  ON public.photos_seance (user_id, date DESC);

-- RLS activée SANS policy : refus total pour anon et authenticated, y compris
-- via le proxy /api/db. service_role (routes serveur) contourne la RLS.
ALTER TABLE public.photos_seance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photos_seance FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VÉRIFICATION — attendu sur la ligne :
--   bucket_prive = true, rls = true, policies_table = 0,
--   acces_anon = false, acces_authenticated = false,
--   policies_storage_bucket = 0, policies_storage_generiques = 0
-- (une policy « générique » sur storage.objects, sans filtre de bucket,
--  ouvrirait aussi ce bucket : elle doit être à 0.)
-- ============================================================
SELECT
  (SELECT NOT public FROM storage.buckets WHERE id = 'photos-seances') AS bucket_prive,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.photos_seance'::regclass) AS rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photos_seance') AS policies_table,
  has_table_privilege('anon', 'public.photos_seance', 'SELECT') AS acces_anon,
  has_table_privilege('authenticated', 'public.photos_seance', 'SELECT') AS acces_authenticated,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%photos-seances%') AS policies_storage_bucket,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND (coalesce(qual, '') || coalesce(with_check, '')) NOT ILIKE '%bucket_id%') AS policies_storage_generiques;
