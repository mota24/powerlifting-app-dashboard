import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Garde-fou de thème. Une couleur écrite en dur dans un composant ne suit pas
 * le thème : c'est ce qui rendait les courbes du graphique de progression
 * blanches sur fond clair, donc invisibles sur le thème rose. Les couleurs
 * doivent venir des variables (var(--foreground)…) ou des classes Tailwind,
 * que la feuille de style convertit par thème.
 */

const RACINE = join(import.meta.dirname, '..')
const COULEUR_EN_DUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/

/** L'écran de connexion s'affiche avant que le profil ne soit connu : toujours en sombre. */
const TOLERES = new Set(['components/power/ecran-connexion.tsx'])

function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((nom) => {
    const relatif = `${dossier}/${nom}`
    if (statSync(join(RACINE, relatif)).isDirectory()) return fichiers(relatif)
    return nom.endsWith('.tsx') ? [relatif] : []
  })
}

test('aucune couleur ecrite en dur dans les composants', () => {
  const fautifs = [...fichiers('app'), ...fichiers('components')]
    .filter((f) => !TOLERES.has(f))
    .flatMap((f) => readFileSync(join(RACINE, f), 'utf8').split('\n')
      .map((ligne, i) => ({ f, n: i + 1, ligne: ligne.trim() }))
      .filter(({ ligne }) => COULEUR_EN_DUR.test(ligne))
      .map(({ f: fichier, n, ligne }) => `${fichier}:${n} ${ligne.slice(0, 80)}`))

  assert.deepEqual(fautifs, [], `Utiliser les variables du thème plutôt qu'une couleur fixe :\n${fautifs.join('\n')}`)
})
