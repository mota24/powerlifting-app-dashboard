'use client'

import { RefreshCw } from 'lucide-react'

/**
 * Filet de sécurité : une erreur d'affichage montre cet écran plutôt qu'une
 * page blanche. Il vit hors du ThemeProvider, d'où la langue lue sur <html>.
 */
const TEXTES = {
  fr: {
    titre: 'Une erreur est survenue',
    detail: "L'écran n'a pas pu s'afficher. Réessaie : tes données sont intactes.",
    bouton: 'Réessayer',
  },
  es: {
    titre: 'Se ha producido un error',
    detail: 'La pantalla no se ha podido mostrar. Inténtalo de nuevo: tus datos están intactos.',
    bouton: 'Reintentar',
  },
}

export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const langue = typeof document !== 'undefined' && document.documentElement.lang === 'es' ? 'es' : 'fr'
  const textes = TEXTES[langue]

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <h1 className="text-lg font-black uppercase tracking-widest text-foreground">{textes.titre}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{textes.detail}</p>
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-[11px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90"
      >
        <RefreshCw className="size-4" /> {textes.bouton}
      </button>
    </div>
  )
}
