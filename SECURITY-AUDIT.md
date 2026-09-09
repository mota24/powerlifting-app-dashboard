# Audit de sécurité — PowerApp

**Dernière mise à jour** : 30 juillet 2026 — **Phases 0 à 5 terminées.**
**Prod** : https://powerlifting-app-dashboard.vercel.app/ · **Supabase** : `jiwjhzbnlyhjmcjekbva`
**Contraintes du projet, rappelées ici car elles ont guidé chaque décision** : coût zéro strict
(Vercel Hobby + Supabase Free, aucune dépendance payante même à palier gratuit expirable), latence
minimale, **`/` doit conserver `x-vercel-cache: HIT` en toute circonstance** — vérifié après chaque
phase, jamais rompu.

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
| `SYNC_TOKENS` | serveur uniquement | ✅ remplace `NEXT_PUBLIC_SYNC_USER_ID`, qui n'est plus lu nulle part |
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

## 9. Bilan final par phase

| Item | Avant | Après | Fichiers | Latence | Coût | Statut |
|---|---|---|---|---|---|---|
| RLS `workout_sets`/`training_blocks`/`user_progress` | Lisibles **et** modifiables par `anon`, sans session (incident réel) | `anon` bloqué (401) sur les 6 tables ; compte légitime voit tout | `supabase/rls-policies.sql` (exécuté par toi) | nulle (RLS = Postgres, déjà sur le chemin) | 0 — inclus Supabase Free | ✅ Corrigé, vérifié en prod |
| CSP nonce (`script-src` sans `unsafe-inline`) | `'unsafe-inline'` | **Inchangé** — Option B retenue | — | — | — | ❌ Non fait, délibérément (§10) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Liste complète (accelerometer, autoplay, payment, usb, etc.), `screen-wake-lock=(self)` vérifié utilisé | `next.config.mjs` | nulle (header sur réponse déjà émise) | 0 | ✅ |
| `Cross-Origin-Opener-Policy` | absent | `same-origin` | `next.config.mjs` | nulle | 0 | ✅ |
| `Cross-Origin-Resource-Policy` | absent | `same-origin` | `next.config.mjs` | nulle | 0 | ✅ |
| `generator: 'v0.app'` | présent | retiré | `app/layout.tsx` | — | 0 | ✅ |
| `productionBrowserSourceMaps` | par défaut (`false` implicite) | `false` explicite | `next.config.mjs` | — | 0 | ✅ |
| CORS | aucun `Access-Control-Allow-*` dans le code | inchangé | — | — | — | ❌ Sans objet, confirmé |
| `.gitignore` | `.env*.local` (ne couvrait pas `.env.local.txt`) | `.env` + `.env.*` | `.gitignore` | — | 0 | ✅ |
| Dependabot | absent | npm, hebdomadaire, PR majeures jamais groupées | `.github/dependabot.yml` | — | 0 — gratuit GitHub | ✅ |
| Énumération de comptes | déjà uniforme (vérifié) | inchangé | — | — | — | ✅ Déjà conforme |
| Validation des schémas d'URL | `href={video}` déjà protégé (`safeHttpUrl`) ; 4× `<img src>` alimentés uniquement par l'API d'upload serveur | inchangé — exhaustif sur tout le dépôt (5 occurrences au total, aucune autre) | — | — | — | ✅ Déjà conforme |
| Rate limit login (échecs) | 5/identifiant + 20/IP par 15 min, couche Supabase **jamais activée** (table absente) | Table `auth_failed_attempts` créée, vérifiée fonctionnelle (5 échecs → 429) | `supabase/migration_rate_limit.sql` (exécuté par toi) | +1 requête Supabase par tentative de login (déjà présent avant) | 0 — inclus Supabase Free | ✅ |
| Rate limit débit `/api/auth/*` | aucun | 10 req/min/IP, mémoire, testé (10 passent, 11ᵉ → 429) | `lib/server/memory-rate-limit.ts` + 4 routes | négligeable (comparaisons en mémoire, zéro I/O) | 0 | ✅ |
| Rate limit débit `/api/db` | aucun | 100 req/min/IP, mémoire, testé (100 passent, 101ᵉ → 429) | `lib/server/memory-rate-limit.ts`, `app/api/db/[...path]/route.ts` | négligeable | 0 | ✅ |
| IDOR `/api/sync-steps` | `userId` client jamais vérifié | jeton opaque résolu côté serveur via `SYNC_TOKENS` ; jeton inconnu → 403 | `app/api/sync-steps/route.ts` | négligeable | 0 | ✅ (revu au passage multi-utilisateur) |
| `.env.local.txt` dans l'historique git | commité le 12/06/2026, supprimé depuis | confirmé **vide**, aucune fuite | — | — | — | ✅ Vérifié, aucune action nécessaire |

**Aucune route n'a changé de mode de rendu.** `/` et `/confidentialite` sont restées `○ Static`
sur l'ensemble des 5 phases — vérifié par `npm run build` et par `x-nextjs-cache: HIT` /
`x-vercel-cache: HIT` après chaque étape. C'est la conséquence directe d'avoir écarté la CSP nonce :
aucun des changements réellement appliqués n'a de coût de rendu.

---

## 10. Pourquoi la CSP nonce n'a pas été faite (Phase 1 / Option D)

Le plan « Option D » supposait une séparation entre route publique et routes authentifiées
dynamiques. **Cette séparation n'existe pas dans ce dépôt** : il n'y a qu'une seule route (`/`) et
un seul layout ([`app/layout.tsx`](app/layout.tsx)). [`app/page.tsx`](app/page.tsx) est un composant
`'use client'` unique qui affiche l'écran de connexion ou l'app entière selon un état déterminé
**côté client**, après coup, via `fetch('/api/auth/session')`. Le HTML servi par `/` est strictement
identique pour un visiteur connecté ou non.

Poser un nonce sur `/` rendrait donc **toute la page dynamique**, dans tous les cas — violation directe
de la Contrainte 2 (`/` doit rester `x-vercel-cache: HIT`) et de la Contrainte 1 (perte du cache CDN
= plus d'invocations Vercel, plus de risque de dépassement de quota Hobby). Le detail des 4 questions
posées avant d'écrire du code est conservé plus haut dans la conversation ; en résumé : aucun
`<script>` inline dans le root layout, mais la question n'est pas là — il n'y a pas de routes
authentifiées séparées auxquelles limiter le nonce.

**Décision retenue : Option B — aucun changement de CSP.** `'unsafe-inline'` reste sur `script-src`
et `style-src`. Justifié par le fait que la Phase 0 n'a trouvé **aucune** surface XSS exploitable
(§5) : le vecteur que la CSP nonce neutralise n'a pas de point d'entrée identifié aujourd'hui dans
cette app. Deux vraies voies existeraient pour revisiter ça plus tard, si le besoin apparaît :
introduire du contenu utilisateur affiché en HTML brut (aucun aujourd'hui), ou scinder réellement
l'app en deux routes (`/login` public + `/app` authentifié, avec redirection serveur) — une refonte
de navigation, pas un ajout de header, hors périmètre de cet audit.

---

## 11. Risques résiduels acceptés (faute de budget ou par choix délibéré)

1. **`'unsafe-inline'` sur `script-src`/`style-src`** — accepté (§10). Aucune surface XSS identifiée
   aujourd'hui ; à revisiter si l'app affiche un jour du contenu non maîtrisé.
2. **RLS `USING (true)` pour `authenticated`** sur `workout_sets`, `training_blocks`, `user_progress` —
   délibéré (app mono-athlète, tables sans colonne `user_id`), documenté dans `rls-policies.sql`.
   Signifie que **tout compte authentifié voit et modifie toutes les données**. Acceptable à un seul
   utilisateur ; **à revoir impérativement** avant d'ouvrir l'app à un second athlète.
3. **`sharp`/`postcss` vulnérables** (transitifs via `next`) — sans surface runtime ici
   (`images.unoptimized: true`, aucun usage de `next/image`). En attente d'un patch amont ; Dependabot
   notifiera. `npm audit fix --force` reste interdit (casserait `next`).
4. **Rate limiting best-effort par instance** (`/api/auth/*`, `/api/db`) — pas un plafond global
   garanti sur serverless (§ commit Phase 4). Accepté : gratuit, protège l'usage réel, pas parfait
   contre un attaquant distribué sur beaucoup d'instances.
5. ~~**`NEXT_PUBLIC_SYNC_USER_ID` public**~~ — **résolu** lors du passage au multi-utilisateur.
   La route lit désormais `SYNC_TOKENS` (serveur uniquement), qui associe un jeton opaque par
   téléphone à un compte ; aucun identifiant de compte ne transite en clair. Reste que `SYNC_SECRET`
   est commun aux deux téléphones : une fuite permettrait d'écrire les pas de l'un ou de l'autre.
6. **`<img src>` alimentés par `photo_urls`** — aucun risque XSS (`<img>` n'exécute pas `javascript:`
   dans les navigateurs modernes), mais un compte authentifié pourrait en théorie écrire une URL
   arbitraire via le proxy `/api/db` en contournant l'upload prévu. Impact réel : chargement d'une
   image externe au pire, pas d'exécution de code. Non traité — écarté comme disproportionné.
7. **HSTS sans `preload`** — délibéré, engagement quasi irréversible (retrait de la liste de
   préchargement des navigateurs = plusieurs mois). À faire sciemment plus tard sur hstspreload.org.

---

## 12. Hors périmètre — à faire manuellement de ton côté

**Gratuit :**
- **Vercel Firewall** (Hobby) : Attack Challenge Mode, jusqu'à 3 règles de pare-feu, 3 blocages IP —
  configurables dans le dashboard Vercel, inclus dans Hobby.
- **Supabase Auth dashboard** : confirmation d'email, longueur minimale de mot de passe, vérification
  HaveIBeenPwned au niveau Supabase (déjà fait côté app dans `change-password`, pas encore au niveau
  Supabase Auth lui-même), durée de vie du JWT, rotation des refresh tokens — tout ça est dans les
  réglages Auth du plan Free.
- **HSTS preload** : soumission sur hstspreload.org, uniquement après avoir ajouté `preload` toi-même
  en toute connaissance de cause (§11.7).

**Payant (donc hors de portée, mentionné pour mémoire uniquement) :**
- **Vercel Managed Rulesets** (WAF géré) et bot management avancé : réservés aux plans payants.
  De toute façon peu utiles ici : générateurs de faux positifs pour une app sans surface XSS identifiée.
- **MFA Supabase Auth** : disponible sur Free en réalité (pas payant) — à activer si tu veux, non fait
  car non demandé explicitement dans cet audit.
- **Rate limiting Vercel natif** : payant, remplacé par la solution maison (Phase 4).

---

## 13. Commits de cet audit

```
2402744  Phase 0 : audit de securite (lecture seule)
9dbdb71  Phase 1 : SQL RLS genere (audit + policies), non execute
0e247a5  Phase 2 : headers complementaires (COOP, CORP, Permissions-Policy etendue)
695ea40  Phase 3 : hygiene (.gitignore, Dependabot)
7ebc690  Phase 4 : rate limiting maison, memoire, sans dependance
```

Phase 5 (CSP nonce) : aucun commit — Option B retenue, statu quo justifié en §10.

**Rien n'a été poussé automatiquement** (`git push`) à aucune étape — c'est resté ton choix à
chaque phase, conformément à la consigne.

---

## 14. Statut final

**Phases 0 à 5 terminées.** RLS corrigé et vérifié en production, rate limiting maison en place et
testé par rafales réelles (pas seulement lu dans le code), headers complets, hygiène git/CI faite.
Aucune régression de rendu (`/` toujours statique), aucune dépendance payante ajoutée.

Ce qui reste ouvert n'est pas un oubli mais un choix documenté : la CSP nonce (architecture ne le
permet pas sans casser tes contraintes), et les items du §12 qui sont entre tes mains (dashboard
Vercel / Supabase).
