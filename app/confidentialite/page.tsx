import Link from 'next/link'

export const metadata = {
  title: 'Politique de confidentialité — PowerApp',
}

// Notice d'information RGPD (Art. 13). Documente les traitements réels de l'app.
// ⚠️ À faire relire : les mentions du responsable de traitement (identité,
// contact) et la base légale retenue doivent être complétées/validées par toi.
export default function ConfidentialitePage() {
  return (
    <main className="min-h-dvh bg-background text-slate-200 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Retour à l&apos;application</Link>
        <h1 className="text-2xl font-black text-white">Politique de confidentialité</h1>
        <p className="text-xs text-slate-500">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">Données traitées</h2>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
            <li>Identifiant de connexion et mot de passe (chiffré).</li>
            <li>Données d&apos;entraînement : exercices, charges, répétitions, RPE, tonnage, commentaires.</li>
            <li>Données relatives à la santé : niveau de douleur lombaire (rééducation), sommeil, fatigue, nombre de pas. Ce sont des <strong>données de catégorie particulière</strong> (Art. 9 RGPD).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">Destinataires et sous-traitants</h2>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
            <li><strong>Supabase</strong> — hébergement de la base de données et authentification.</li>
            <li><strong>Google (Gemini)</strong> — le coach IA transmet ton historique récent (dont douleur, sommeil, fatigue) pour générer des séances. Ce traitement n&apos;a lieu qu&apos;avec ton <strong>consentement explicite</strong>, demandé avant la première utilisation. Il peut impliquer un transfert hors UE (Art. 44-49).</li>
            <li><strong>Vercel Analytics</strong> — mesure d&apos;audience (traite l&apos;adresse IP), chargée uniquement après ton acceptation du bandeau de consentement.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">Conservation</h2>
          <p className="text-sm text-slate-300">Les données d&apos;entraînement sont conservées tant que le compte est actif. Les pas quotidiens synchronisés sont supprimés à la suppression du compte.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">Tes droits (Art. 15 à 21 RGPD)</h2>
          <p className="text-sm text-slate-300">
            Tu peux à tout moment <strong>exporter tes données</strong> (accès et portabilité) et
            <strong> supprimer ton compte</strong> (effacement) depuis le menu de l&apos;application.
            Le retrait du consentement au traitement par l&apos;IA se fait en refusant la demande de consentement.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">Responsable de traitement</h2>
          <p className="text-sm text-slate-400">[À compléter : identité et contact du responsable de traitement, base légale retenue pour chaque finalité.]</p>
        </section>
      </div>
    </main>
  )
}
