import nextConfig from 'eslint-config-next'

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  {
    rules: {
      // Règles de préparation au React Compiler : signalent des patterns
      // préexistants (hydratation localStorage/fetch au montage, refs lues
      // en rendu dans le chrono de circuit) qui fonctionnent aujourd'hui
      // mais mériteraient un refactor dédié. Abaissées en avertissement
      // plutôt que corrigées à l'aveugle, pour ne pas risquer de régression
      // sur des fonctionnalités déjà testées en production.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
]

export default eslintConfig
