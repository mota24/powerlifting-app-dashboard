-- ============================================================
-- RATTRAPAGE FACULTATIF — validation du 08/09/2026 (compte 1)
-- À coller dans Supabase > SQL Editor, seulement si tu le souhaites.
--
-- Le journal des validations n'existe que depuis le 10/09. La séance du
-- 08/09 (séries notées) avait été validée avant, donc le classement ne la
-- compte pas. Ce script l'inscrit au journal.
--
-- Effet attendu sur la semaine du 07/09 : +20 (séance) et +5 (série d'un
-- jour), soit 25 points.
--
-- Le SQL Editor contourne la règle « jour même » (il n'est pas soumis à la
-- RLS) : c'est voulu ici, et c'est la seule date rattrapée.
-- Idempotent : relancé, il n'ajoute rien de plus.
-- ============================================================

INSERT INTO public.validations_seance (user_id, date, type, valide_le)
VALUES ('1', DATE '2026-09-08', 'seance', TIMESTAMPTZ '2026-09-08 20:00:00+02')
ON CONFLICT (user_id, date) DO NOTHING;


-- VÉRIFICATION — attendu : une ligne, compte 1, 2026-09-08, seance.
SELECT user_id, date, type, valide_le
FROM public.validations_seance
ORDER BY date;
