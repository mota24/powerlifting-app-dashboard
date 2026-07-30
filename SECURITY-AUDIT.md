# Audit de sécurité — PowerApp

**Date** : 29 juillet 2026
**Périmètre** : Phase 0 (lecture seule). Aucun fichier applicatif modifié.
**Prod** : https://powerlifting-app-dashboard.vercel.app/ · **Supabase** : `jiwjhzbnlyhjmcjekbva`

---

## 0. Incident en cours — RÉSOLU (vérifié)

Avant l'audit, j'ai vérifié l'état de l'incident RLS qui laissait l'app « hors ligne » depuis ~7 h.
**C'est réglé**, et dans l'état idéal : accès complet pour le compte légitime, blocage total pour `anon`.

| Table | Lignes réelles | Compte connecté | Rôle `anon` |
|---|---|---|---|
| `workout_sets` | 114 | 114 ✅ | bloqué ✅ |
| `training_blocks` | 2 | 2 ✅ | bloqué ✅ |
| `user_progress` | 1 | 1 ✅ | bloqué ✅ |
| `seances_pas` | 22 | 22 ✅ | bloqué ✅ |
| `competitions` | 3 | 3 ✅ | bloqué ✅ |
| `bodyweight_logs` | 1 | 1 ✅ | bloqué ✅ |

Aucune donnée perdue.

---

## 1. Architecture détectée : **A — proxy serveur**

**Conclusion : le navigateur ne parle JAMAIS directement à Supabase.**

Preuves :

| Élément | Fichier | Constat |
|---|---|---|
| Client navigateur | [`lib/supabase.ts:10-23`](lib/supabase.ts) | `createClient()` pointe sur `${window.location.origin}/api/db` — **pas** sur l'URL Supabase |
| Proxy | [`app/api/db/[...path]/route.ts`](app/api/db/[...path]/route.ts) | Relaie vers PostgREST en attachant le JWT lu d'un cookie httpOnly ; refuse tout chemin hors `rest/v1/` |
| Client admin | [`lib/supabase-admin.ts:5-7`](lib/supabase-admin.ts) | `service_role`, avec garde `if (typeof window !== 'undefined') throw` |
| Realtime | — | **Aucun** `.channel()` / WebSocket dans tout le code |
| Storage | [`app/api/palmares/photo/route.ts:54-61`](app/api/palmares/photo/route.ts) | Écriture **serveur uniquement** (`service_role`). Lecture = URLs publiques rendues en `<img>` |

Les 9 composants clients (`app/page.tsx`, `components/power/*.tsx`) importent `lib/supabase`, mais celui-ci
tape le proxy same-origin. Il n'existe que **deux** instanciations de client dans tout le dépôt.

### ⚠️ Correction d'une prémisse du cahier des charges

> « La CSP actuelle contient `connect-src 'self'` **sans** le domaine Supabase, ce qui est incohérent
> avec des appels directs depuis le client. »

**Cette incohérence n'existe pas.** En architecture A, `connect-src 'self'` est **exactement correct** :
toutes les requêtes de données partent vers la même origine. Conséquences pour la Phase 1 :

- ❌ **Ne PAS ajouter** `https://…supabase.co` à `connect-src` — cela rouvrirait inutilement une
  destination réseau que l'app n'utilise pas.
- ❌ **Ne PAS ajouter** `wss://…supabase.co` — **aucun Realtime** n'est utilisé.
- ✅ **Conserver** le domaine Supabase dans `img-src` (déjà présent) : les photos de compétitions
  sont servies depuis le Storage public.

---

## 2. Headers de sécurité actuels

**Emplacement unique** : [`next.config.mjs`](next.config.mjs), via `async headers()`.
**Aucun `middleware.ts`. Aucun `vercel.json`.** → aucun risque de doublon ou de conflit.

| Header | Valeur actuelle | Statut |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://…supabase.co; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` | ⚠️ `'unsafe-inline'` sur `script-src` → cible Phase 1 |
| `X-Frame-Options` | `DENY` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | ⚠️ sans `preload` (choix délibéré antérieur) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | ⚠️ à étendre (Phase 2) |
| `X-Powered-By` | supprimé (`poweredByHeader: false`) | ✅ |
| `Cross-Origin-Opener-Policy` | **absent** | ❌ Phase 2 |
| `Cross-Origin-Resource-Policy` | **absent** | ❌ Phase 2 |

`productionBrowserSourceMaps` : non défini → **déjà `false` par défaut** (aucune source map exposée).

---

## 3. Route Handlers (9)

| Route | Auth | Notes |
|---|---|---|
| `app/api/auth/login/route.ts` | publique | Rate limit 5/identifiant + 20/IP par 15 min. Message d'erreur **uniforme** (pas d'énumération de comptes) ✅ |
| `app/api/auth/logout/route.ts` | cookie | |
| `app/api/auth/session/route.ts` | cookie | |
| `app/api/auth/change-password/route.ts` | cookie + mot de passe actuel | Rate limité, politique de robustesse, refus des mots de passe fuités (HIBP, fail-closed) ✅ |
| `app/api/account/delete/route.ts` | cookie | RGPD art. 17 |
| `app/api/db/[...path]/route.ts` | cookie | Proxy PostgREST, restreint à `rest/v1/` |
| `app/api/coach/route.ts` | cookie + consentement | Gemini |
| `app/api/palmares/photo/route.ts` | cookie | Upload Storage, type/taille validés serveur |
| `app/api/sync-steps/route.ts` | `SYNC_SECRET` + `userId` vérifié | Contrôle IDOR ajouté récemment |

**Aucun header `Access-Control-Allow-*` posé nulle part** → voir Phase 3 ci-dessous.

---

## 4. PWA — **l'app n'en est pas une**

Recherche exhaustive : **aucun** `manifest.json` / `manifest.webmanifest`, **aucun** service worker,
**aucune** librairie (`next-pwa`, `serwist`, `workbox` absents de `package.json`).
`public/` ne contient que `icon.PNG`.

Le mode « hors ligne » que tu as vu **n'est pas un service worker** : c'est l'indicateur interne de
[`session-form.tsx`](components/power/session-form.tsx) basé sur `navigator.onLine` et l'échec des
sauvegardes — d'où son déclenchement pendant l'incident RLS.

**Conséquence : la quasi-totalité de la Phase 5 est sans objet** (pas de cache SW à purger, pas de
`scope`/`start_url` à restreindre).

---

## 5. Surfaces XSS

`dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `eval(`, `new Function(`, `document.write` :
**zéro occurrence** dans `app/`, `components/`, `lib/`.

Injections dynamiques dans des attributs :

| Emplacement | Variable | Protection |
|---|---|---|
| `palmares.tsx:844` | `href={video}` | ✅ `safeHttpUrl()` — n'accepte que `http(s)://`, testé contre `javascript:`, `data:`, `vbscript:`, casse mélangée, espaces de tête |
| `palmares.tsx:625,833,878,1208` | `<img src={url}>` | ✅ URLs issues du Storage Supabase, écrites uniquement par la route serveur ; `img-src` CSP restreint aux origines autorisées |

**Aucune action requise.**

---

## 6. Session

**Déjà en cookies `HttpOnly` — pas de `localStorage`.**

- [`lib/supabase.ts:19-21`](lib/supabase.ts) : `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`
- [`lib/server/auth-session.ts:43`](lib/server/auth-session.ts) : `{ httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' }`
- Purge des reliquats `sb-*` du `localStorage` au chargement ([`app/page.tsx`](app/page.tsx))
- `@supabase/supabase-js` **2.108.2** · `@supabase/ssr` **non installé**

### ⚠️ La Phase 4.2 est déjà réalisée — autrement

L'objectif (« session en cookies HttpOnly, Secure, SameSite=Lax ») est **atteint**, via une
implémentation maison plutôt que `@supabase/ssr`. Migrer vers `@supabase/ssr` serait une réécriture
lourde (proxy `/api/db`, toutes les routes) **sans gain de sécurité** — le modèle actuel est même plus
strict : le navigateur n'a aucun jeton *et* ne peut pas joindre Supabase directement.

**Ma recommandation : ne pas faire la Phase 4.2.** À confirmer par toi.

---

## 7. Secrets

| Variable | Exposition | Verdict |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | ✅ acceptable |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | ✅ acceptable |
| `NEXT_PUBLIC_SYNC_USER_ID` | client | ⚠️ pas un secret (simple identifiant), mais inutilement public — voir risques résiduels |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur uniquement | ✅ `lib/supabase-admin.ts` + 2 routes API, jamais côté client |
| `GEMINI_API_KEY`, `SYNC_SECRET` | serveur uniquement | ✅ |

**Aucune clé `service_role` côté client.** ✅

### Historique git

Un fichier `.env.local.txt` a été commité le 12/06/2026 (`85a2d2d0`), supprimé depuis.
**Il est vide (0 octet)** : aucune clé, aucun JWT. **Aucune compromission.**

⚠️ **Faille de `.gitignore`** : le motif `.env*.local` (ligne 10) ne couvre **pas** `.env.local.txt`,
`.env.backup`, `.env.txt`… Un fichier de ce nom contenant de vraies valeurs serait commité.
→ à durcir (Phase 2 ou 5).

---

## 8. Dépendances — `npm audit`

**Production : 5 vulnérabilités (3 hautes, 2 modérées). Toutes transitives, via `next` lui-même.**

| Paquet | Sévérité | Origine | Risque réel ici |
|---|---|---|---|
| `sharp` <0.35.0 | haute | `next` | **Nul** — `images: { unoptimized: true }` dans `next.config.mjs`, et l'app n'utilise pas `next/image` (que des `<img>`). `sharp` n'est jamais appelé au runtime. |
| `postcss` | modérée | `next` | Build uniquement, pas de surface runtime |

🚫 **NE PAS lancer `npm audit fix --force`** : cela installerait **`next@9.3.3`** (annoncé dans la
sortie de l'audit), soit une régression de 7 versions majeures qui détruirait l'application.

**Action correcte** : attendre un patch Next amont. Je peux ajouter Dependabot pour être notifié.

---

## 9. Plan d'exécution révisé (Phases 1 → 5)

| Phase | Cahier des charges initial | Réalité constatée | Recommandation |
|---|---|---|---|
| **1 — CSP nonce** | CSP nonce + `strict-dynamic`, Report-Only | Applicable. `connect-src 'self'` à **conserver** (arch. A), pas de `wss://` | ⚠️ **Arbitrage nécessaire — voir ci-dessous** |
| **2 — Headers** | Permissions-Policy étendue, COOP, CORP, HSTS preload, `poweredByHeader`, retrait `generator` | 4 headers déjà là ; COOP/CORP absents ; `generator: 'v0.app'` présent ([`app/layout.tsx:13`](app/layout.tsx)) | ✅ **À faire** — gain net, risque quasi nul |
| **3 — CORS** | Helper `lib/cors.ts` + allowlist | **Aucun** `Access-Control-Allow-*` dans le code. Le `*` observé vient des assets `_next/static` (normal, géré par Vercel) | ❌ **Sans objet** — ne rien créer |
| **4.1 — Audit RLS** | Générer `audit-rls.sql` + `rls-policies.sql` | Utile, surtout après l'incident | ✅ **À faire** (SQL fourni, non exécuté) |
| **4.2 — Session cookies** | Migrer vers `@supabase/ssr` | **Objectif déjà atteint** autrement (§6) | ❌ **Ne pas faire** — réécriture lourde, zéro gain |
| **5 — PWA & divers** | Cache SW, manifest, purge au logout | **Pas de PWA** (§4) | ⚠️ **Partiel** : garder Dependabot + `.gitignore`. Reste sans objet (énumération de comptes et validation d'URL **déjà** conformes) |

### ❓ Arbitrage à trancher — Phase 1 (CSP nonce)

Le nonce **force le rendu dynamique** sur les routes couvertes. Impact mesuré sur ton app :

- Routes actuellement statiques : **`/`** et **`/confidentialite`** (`○ prerendered` au build).
- `/` est servi aujourd'hui depuis le CDN Vercel (`x-vercel-cache: HIT`, `Cache-Control: s-maxage=31536000`).
- Avec un nonce : **`/` devient dynamique** → rendu serveur à chaque visite, plus de cache CDN,
  latence en hausse et consommation de fonctions Vercel en hausse.

**Bénéfice réel dans ton cas précis** : retirer `'unsafe-inline'` de `script-src` protège contre
l'injection de script. Or l'audit ne trouve **aucune surface XSS** (§5) : pas de rendu HTML brut,
pas d'`eval`, les seules URL dynamiques sont validées. Le vecteur que la CSP nonce neutralise
n'a donc pas de point d'entrée identifié aujourd'hui.

C'est un arbitrage « défense en profondeur » contre « perf + coût », pas une évidence :

- **Option A — faire la Phase 1** : protection maximale contre une XSS *future* (si tu ajoutes un jour
  du contenu riche, du markdown, un champ libre affiché en HTML). Coût : `/` perd son cache CDN.
- **Option B — sauter la Phase 1**, garder `'unsafe-inline'`, et faire les Phases 2, 4.1 et 5-partiel.
  Coût : aucun. Risque : une XSS introduite plus tard serait moins contenue.
- **Option C — compromis** : Phase 1 en **Report-Only permanent** (rapports collectés, aucun blocage).
  ⚠️ Attention : cela **force quand même le rendu dynamique** — tu paies le coût perf sans obtenir
  le bénéfice de blocage. À mon sens, le pire des deux mondes.

**Ma recommandation : Option B pour l'instant**, et Phase 1 le jour où tu introduis une surface
d'affichage de contenu non maîtrisé. Mais c'est ton appel — dis-moi.

---

## 10. Risques résiduels identifiés

1. **`NEXT_PUBLIC_SYNC_USER_ID` exposé côté client** — ce n'est pas un secret, mais il révèle
   l'identifiant du compte. Combiné à un `SYNC_SECRET` qui fuiterait, il facilite l'écriture de pas.
   Il n'est utilisé que dans [`app/page.tsx`](app/page.tsx) et [`sync-steps`](app/api/sync-steps/route.ts) :
   déplaçable en variable serveur, à voir.
2. **`.gitignore` trop étroit** sur les fichiers d'environnement (§7).
3. **`sharp`/`postcss` vulnérables** en transitif — sans surface runtime ici, mais à suivre (§8).
4. **RLS `USING (true)` pour `authenticated`** sur `workout_sets`, `training_blocks`, `user_progress` :
   volontaire (app mono-athlète, tables sans colonne `user_id`), mais signifie que **tout compte
   authentifié voit toutes les données**. Acceptable à un seul utilisateur ; à revoir impérativement
   avant d'ouvrir l'app à un second athlète. Traité en Phase 4.1.
5. **Rate limiting mémoire + base** — la couche partagée (`auth_failed_attempts`) est désormais en
   place et vérifiée ; la couche mémoire seule serait peu fiable en serverless.

---

## 11. Hors périmètre — rappel pour toi

- **Vercel Firewall / WAF** : Managed Rulesets (Log → Deny), rate limiting `/api/auth/*` (5–10 req/min/IP),
  bot management. Via le dashboard Vercel.
- **Supabase Auth** : confirmation d'email, mot de passe ≥ 12 caractères, vérification HIBP, JWT ≤ 1 h
  avec rotation des refresh tokens, MFA. *(Note : la politique de robustesse + HIBP est déjà appliquée
  côté app dans `change-password`, mais pas au niveau Supabase Auth lui-même.)*
- **HSTS preload** : soumission sur hstspreload.org — **seulement** après avoir ajouté la directive
  `preload` (Phase 2) et vérifié que tous les sous-domaines servent bien du HTTPS. Quasi irréversible.
- **Bascule CSP Report-Only → enforcing** : uniquement si Option A retenue.

---

## 12. Statut

**Phase 0 terminée. Aucun fichier applicatif modifié** (seul ce rapport a été créé).

**En attente de ta validation, et de ta décision sur l'arbitrage Phase 1 (Option A / B / C).**
