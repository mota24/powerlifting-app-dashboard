-- Table pour l'historique du poids de corps
CREATE TABLE IF NOT EXISTS bodyweight_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT split_part(((current_setting('request.jwt.claims', true))::jsonb ->> 'email'), '@', 1),
    date DATE NOT NULL,
    weight NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bodyweight_logs_user_date_key UNIQUE (user_id, date)
);

-- Index pour optimiser les requêtes par date et utilisateur
CREATE INDEX IF NOT EXISTS idx_bodyweight_logs_user_date ON bodyweight_logs (user_id, date DESC);

-- Activation de la RLS
ALTER TABLE bodyweight_logs ENABLE ROW LEVEL SECURITY;

-- Politique de sécurité : l'utilisateur ne peut lire et modifier que ses propres données
DROP POLICY IF EXISTS "bodyweight_logs_authentifies" ON bodyweight_logs;
CREATE POLICY "bodyweight_logs_authentifies"
    ON bodyweight_logs
    FOR ALL
    USING (
        (current_setting('request.jwt.claims', true))::jsonb ->> 'email' LIKE user_id || '@%'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true))::jsonb ->> 'email' LIKE user_id || '@%'
    );

-- Interdire l'accès public
REVOKE ALL ON bodyweight_logs FROM anon;
