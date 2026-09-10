-- ============================================================
-- CORRECTIF PONCTUEL — série du compte 1
-- À coller dans Supabase > SQL Editor.
--
-- Un bug faisait reculer la date de dernière validation quand on validait
-- un jour passé après le jour même. Le 10/09, les validations successives
-- du 10, du 09 puis du 08 ont laissé last_completed_date au 08/09.
-- Conséquence : la prochaine validation compterait le 09 et le 10 comme
-- manqués et remettrait la série à 1.
--
-- On replace la date sur la vraie dernière validation (10/09), en gardant
-- la série à 3.
--
-- Garde-fous : la mise à jour ne s'applique que si l'état est toujours
-- celui constaté (série 3, dernière validation 08/09). Si tu as revalidé
-- entre-temps, rien n'est modifié : relance-moi plutôt.
-- ============================================================

UPDATE user_progress
SET last_completed_date = DATE '2026-09-10'
WHERE user_id = '1'
  AND streak_days = 3
  AND last_completed_date = DATE '2026-09-08';


-- VÉRIFICATION — attendu pour le compte 1 : série 3, dernière validation 2026-09-10.
SELECT user_id, streak_days, last_completed_date
FROM user_progress
ORDER BY user_id;
