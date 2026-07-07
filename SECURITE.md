# Sécurité de l'application

Ce document décrit l'architecture d'authentification mise en place le 2026-07-07
et les deux actions manuelles restantes à faire dans le tableau de bord Supabase.

## 1. Jeton d'authentification : cookies httpOnly (fait ✅)

**Avant** : le client Supabase stockait la session (JWT + refresh token) dans le
`localStorage` du navigateur. N'importe quel script injecté (XSS, extension
malveillante) pouvait lire et exfiltrer le jeton.

**Maintenant** : le navigateur ne détient plus aucun jeton.

- La connexion passe par `POST /api/auth/login`, qui vérifie les identifiants
  auprès de Supabase **côté serveur** et dépose les jetons dans deux cookies
  `httpOnly` + `secure` + `sameSite=lax` (`pl-access-token`, `pl-refresh-token`).
  Ces cookies sont invisibles pour le JavaScript de la page.
- Toutes les requêtes base de données du front passent par le proxy
  `/api/db/[...path]` ([route.ts](app/api/db/[...path]/route.ts)) : c'est le
  serveur qui lit le cookie, attache le jeton, et rafraîchit la session quand
  le jeton expire. Seul PostgREST (`rest/v1/`) est exposé par ce proxy.
- `GET /api/auth/session` renvoie uniquement l'utilisateur (id/email), jamais
  les jetons. `POST /api/auth/logout` révoque la session côté Supabase et
  efface les cookies.
- Au chargement, l'app purge les anciennes sessions `sb-*` restées dans le
  `localStorage` des navigateurs qui avaient utilisé l'ancienne version.
- Conséquence assumée : le canal Realtime du header (barre XP) a été remplacé
  par un événement local — un WebSocket authentifié aurait exigé un jeton
  lisible par le JavaScript.
- Limite connue (standard JWT, identique à avant) : la déconnexion révoque le
  refresh token et efface les cookies, mais un jeton d'accès déjà émis reste
  techniquement valide jusqu'à son expiration (~1 h) s'il avait été volé avant.

## 2. Droits d'accès appliqués côté serveur (fait ✅ + 1 action ⚠️)

L'app n'a pas de rôle « administrateur » côté navigateur : il n'y avait donc
aucune vérification de droits truquable à déplacer. Les protections réelles
sont toutes côté serveur :

- `/api/coach` (IA) : exige une session valide, lue depuis le cookie httpOnly.
- `/api/sync-steps` : réservée au secret serveur `SYNC_SECRET` (raccourci iPhone).
- Accès aux tables : appliqué par la base via Row Level Security.

⚠️ **Action requise** : exécuter [supabase/policies_securite.sql](supabase/policies_securite.sql)
dans Supabase > SQL Editor. Il active RLS sur les 4 tables (`workout_sets`,
`training_blocks`, `user_progress`, `seances_pas`), réserve l'accès aux comptes
connectés, et garde l'écriture de `seances_pas` exclusivement côté serveur.
Sans RLS, la clé anon (publique dans le bundle JS) ouvre toutes les données.

## 3. Inscription et vérification d'email (1 action ⚠️)

L'app **n'a volontairement aucun formulaire d'inscription** : les comptes sont
créés à la main dans Supabase, avec des emails « fantômes » (`identifiant@power.app`)
qui ne peuvent pas recevoir de courrier. Une vérification par email à
l'inscription n'est donc pas applicable telle quelle — la protection
équivalente consiste à fermer l'inscription publique :

⚠️ **Action requise** : dans le tableau de bord Supabase, ouvrir
**Authentication → Sign In / Providers** et désactiver
**« Allow new users to sign up »**. Sans cela, n'importe qui possédant la clé
anon (publique) peut appeler l'endpoint d'inscription de Supabase directement
et se créer un compte actif — et donc lire les données via les policies
« authenticated ».

Si un jour l'app passe à de vraies adresses email, activer aussi
**« Confirm email »** au même endroit : le compte restera inactif tant que
l'adresse n'aura pas été confirmée.

## 4. Limite de tentatives de connexion (fait ✅ + 1 action ⚠️)

La connexion (`/api/auth/login`) et le changement de mot de passe
(`/api/auth/change-password`) sont protégés contre la force brute par
[rate-limit.ts](lib/server/rate-limit.ts) :

- **5 échecs par identifiant / compte sur 15 minutes** → blocage jusqu'à ce
  que le plus ancien échec sorte de la fenêtre (réponse 429 + `Retry-After`) ;
- **20 échecs par adresse IP sur 15 minutes** (couvre la pulvérisation sur
  plusieurs identifiants) ;
- une connexion réussie remet le compteur de l'identifiant à zéro.

Deux couches : la mémoire du processus (toujours active) et une table Supabase
partagée entre toutes les instances serverless.

⚠️ **Action requise** : exécuter
[supabase/migration_rate_limit.sql](supabase/migration_rate_limit.sql) dans
Supabase > SQL Editor pour créer la table `auth_failed_attempts` (inaccessible
aux clients : RLS sans policy). Sans elle, seule la couche mémoire protège —
suffisant sur un serveur unique, partiel sur du serverless multi-instances.

Il n'existe **pas de page « mot de passe oublié »** dans l'app (les emails
fantômes `@power.app` ne peuvent pas recevoir de courrier) : il n'y a donc
rien à limiter de ce côté. L'endpoint `recover` de Supabase reste couvert par
les limites d'envoi d'emails de Supabase (Authentication → Rate Limits).

## 5. Politique de mots de passe + fuites (fait ✅)

Appliquée **côté serveur** par [password-policy.ts](lib/server/password-policy.ts)
dans `/api/auth/change-password` (accessible via le menu → « Mot de passe ») :

1. **Robustesse** : 12 caractères minimum (72 max), avec au moins une
   minuscule, une majuscule et un chiffre.
2. **Fuites de données** : le mot de passe est vérifié contre la base
   **Have I Been Pwned** en k-anonymat — seuls les 5 premiers caractères du
   hash SHA-1 sont envoyés (avec padding), jamais le mot de passe ni son hash
   complet. S'il apparaît dans une fuite connue, il est refusé. Si HIBP est
   injoignable, la mise à jour est refusée (fail-closed) plutôt que validée
   sans contrôle.
3. Le mot de passe **actuel** est exigé et sa vérification est soumise au même
   rate limiting que la connexion.

L'app n'ayant pas de formulaire d'inscription, la « création de compte » se
fait dans le tableau de bord Supabase : pour que les comptes créés là-bas
respectent aussi des règles, configurer **Authentication → Passwords**
(longueur minimale, caractères requis — et « Prevent use of leaked
passwords », option du plan Pro, qui active le même contrôle HIBP côté
Supabase). Utiliser les règles ci-dessus comme référence.

## 6. Double authentification (2FA) — proposition

Supabase supporte la 2FA TOTP (application d'authentification type Google
Authenticator) via son API MFA. Elle n'est pas encore branchée dans l'app :
avec l'architecture cookies httpOnly, il faut ajouter des routes serveur
(`/api/auth/mfa/enroll`, `challenge`, `verify`) et un petit écran d'enrôlement
(QR code) après la connexion.

Si tu veux l'activer, demande « ajoute la 2FA » : c'est le prolongement naturel
de cette architecture. En attendant, l'inscription fermée + mots de passe forts
restent la protection principale des deux comptes existants.
