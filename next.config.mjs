// Origine Supabase (photos de compétitions servies directement depuis le
// Storage public) : nécessaire dans img-src, sinon la CSP les bloquerait.
// Tout le reste (DB, auth) passe par le proxy same-origin /api/db et /api/auth,
// jamais d'appel direct du navigateur vers Supabase.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
  } catch {
    return ''
  }
})()

// script-src/style-src gardent 'unsafe-inline' : Next.js (App Router) injecte
// son payload d'hydratation en <script> inline, et plusieurs composants
// utilisent des style={{...}} React (donc du style inline). Un CSP sans
// 'unsafe-inline' nécessiterait un nonce généré par requête (middleware +
// rendu forcé en dynamique sur tout le site) — un chantier disproportionné
// ici. Le reste de la CSP (frame-ancestors, connect-src, object-src...)
// reste strict.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
  `font-src 'self' data:`,
  `connect-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Ne pas annoncer le framework utilisé (X-Powered-By: Next.js).
  poweredByHeader: false,
  // Déjà false par défaut (aucune source map générée jusqu'ici) : explicite
  // pour ne pas dépendre d'un défaut qui pourrait changer.
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // Redondant avec frame-ancestors pour les navigateurs qui ne
          // supportent pas encore cette directive CSP.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Liste complète désactivée par défaut, avec deux exceptions
          // délibérées, chacune vérifiée réellement utilisée :
          // - screen-wake-lock=(self) : garder l'écran allumé pendant une
          //   séance (circuit-timer.tsx, rest-timer.tsx) ;
          // - camera=(self) : scanner le code-barres d'un aliment
          //   (components/power/nutrition.tsx). Le site lui-même uniquement,
          //   jamais un iframe tiers, et le navigateur demande toujours
          //   l'autorisation à l'utilisateur.
          // fullscreen et publickey-credentials-get restent à (self) par
          // cohérence, bien qu'inutilisés : (self) exige un appel JS explicite
          // pour avoir le moindre effet.
          {
            key: 'Permissions-Policy',
            value:
              'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(self), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(self), screen-wake-lock=(self), sync-xhr=(), usb=(), xr-spatial-tracking=()',
          },
          // Pas de "preload" : cela engage tous les sous-domaines présents
          // et futurs à servir du HTTPS, de façon quasi irréversible (retrait
          // de la liste de préchargement des navigateurs = plusieurs mois).
          // À activer plus tard si voulu, en connaissance de cause.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Pas d'OAuth/popup dans l'app (login identifiant + mot de passe
          // uniquement) : same-origin strict, pas de same-origin-allow-popups.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // Pas de COEP : aucun besoin de SharedArrayBuffer, et ça casserait
          // le chargement des photos Supabase Storage (CORP different-origin
          // implicite) sans aucun bénéfice ici.
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
