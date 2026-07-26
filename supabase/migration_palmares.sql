-- ============================================================
-- MIGRATION PALMARÈS — à coller dans Supabase > SQL Editor
-- Historique de compétitions : nom, date, catégorie, PDC, records
-- SBD et photo de l'événement (Supabase Storage).
-- ============================================================

-- 1. TABLE
CREATE TABLE IF NOT EXISTS competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT split_part(((current_setting('request.jwt.claims', true))::jsonb ->> 'email'), '@', 1),
    name TEXT NOT NULL,
    date DATE NOT NULL,
    category TEXT,
    bodyweight NUMERIC,
    squat NUMERIC,
    bench NUMERIC,
    deadlift NUMERIC,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitions_user_date ON competitions (user_id, date DESC);

-- 2. RLS — même modèle que bodyweight_logs : donnée personnelle, accès
--    restreint au préfixe d'email exact (pas de partage athlète/coach ici).
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "competitions_authentifies" ON competitions;
CREATE POLICY "competitions_authentifies"
    ON competitions
    FOR ALL
    USING (
        split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id
    )
    WITH CHECK (
        split_part((current_setting('request.jwt.claims', true))::jsonb ->> 'email', '@', 1) = user_id
    );

REVOKE ALL ON competitions FROM anon;

-- ============================================================
-- 3. STORAGE — bucket pour les photos d'événement.
--    Lecture publique (photos affichées comme en-tête de carte),
--    écriture strictement réservée au serveur : l'upload passe par
--    /api/palmares/photo (cookie httpOnly + clé service_role), jamais
--    directement depuis le navigateur avec la clé anon.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('competition-photos', 'competition-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "competition_photos_lecture_publique" ON storage.objects;
CREATE POLICY "competition_photos_lecture_publique"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'competition-photos');

-- Aucune policy INSERT/UPDATE/DELETE pour anon/authenticated : seule la
-- clé service_role (utilisée par la route serveur) peut écrire.
