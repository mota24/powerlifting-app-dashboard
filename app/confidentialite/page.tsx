import Link from 'next/link'

export const metadata = {
  title: 'Politique de confidentialité — PowerApp',
}

export default function ConfidentialitePage() {
  return (
    <main className="min-h-dvh bg-black text-zinc-400 px-6 py-16">
      <div className="mx-auto max-w-2xl space-y-12">
        <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
          ← RETOUR À L&apos;APPLICATION
        </Link>
        
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-widest">Confidentialité</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-3">
            MISE À JOUR : {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Données traitées</h2>
          <ul className="list-inside text-xs font-bold uppercase tracking-wider text-zinc-500 space-y-3 leading-relaxed">
            <li>— IDENTIFIANT ET MOT DE PASSE (CHIFFRÉS).</li>
            <li>— DONNÉES D&apos;ENTRAÎNEMENT : CHARGES, RPE, TONNAGE, NOTES.</li>
            <li>— <strong className="text-white">DONNÉES DE SANTÉ :</strong> DOULEUR, SOMMEIL, FATIGUE, PAS, POIDS DE CORPS (ART. 9 RGPD).</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Conservation</h2>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 leading-relaxed">
            LES DONNÉES SONT CONSERVÉES TANT QUE LE COMPTE EST ACTIF. LES PAS QUOTIDIENS ET L&apos;HISTORIQUE DE POIDS DE CORPS SONT SUPPRIMÉS À LA SUPPRESSION DU COMPTE.
          </p>
        </section>

        <section className="space-y-4 border-t border-zinc-900 pt-8">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Tes droits (Art. 15 à 21 RGPD)</h2>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 leading-relaxed">
            TU PEUX À TOUT MOMENT <strong className="text-white">SUPPRIMER TON COMPTE</strong> DEPUIS L&apos;APPLICATION.
            LE RETRAIT DU CONSENTEMENT IA SE FAIT EN REFUSANT LA DEMANDE DÉDIÉE.
          </p>
        </section>
      </div>
    </main>
  )
}