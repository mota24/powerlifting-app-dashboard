-- Requiert public.compte_courant() : lancer d'abord migration_securite_comptes.sql.
-- Table pour l'historique du poids de corps
CREATE TABLE IF NOT EXISTS bodyweight_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT public.compte_courant(),
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
-- (comparaison exacte du préfixe d'email plutôt qu'un LIKE : un user_id contenant
-- '%' ou '_' ne peut plus élargir le motif de correspondance par accident)
DROP POLICY IF EXISTS "bodyweight_logs_authentifies" ON bodyweight_logs;
CREATE POLICY "bodyweight_logs_authentifies"
    ON bodyweight_logs
    FOR ALL
    USING (
        (SELECT public.compte_courant()) = user_id
    )
    WITH CHECK (
        (SELECT public.compte_courant()) = user_id
    );

-- Interdire l'accès public
REVOKE ALL ON bodyweight_logs FROM anon;
