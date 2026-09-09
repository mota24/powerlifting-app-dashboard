'use client'

import React, { createContext, useContext, useEffect } from 'react';
import type { ModeApp } from '@/lib/powerlifting';

export type Langue = 'fr' | 'ca';
type EtatProfil = { theme: string; mode: ModeApp; prenom: string | null; langue: Langue };

const ThemeContext = createContext<EtatProfil>({ theme: 'dark', mode: 'powerlifting', prenom: null, langue: 'fr' });

/**
 * Applique le thème et la langue sur <html>, et met le profil à disposition
 * de l'arbre. Le profil est chargé par la page (une seule requête).
 */
export const ThemeProvider = ({
  children,
  theme = 'dark',
  mode = 'powerlifting',
  prenom = null,
  langue = 'fr',
}: {
  children: React.ReactNode;
  theme?: string;
  mode?: ModeApp;
  prenom?: string | null;
  langue?: Langue;
}) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('lang', langue);
  }, [theme, langue]);

  return <ThemeContext.Provider value={{ theme, mode, prenom, langue }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
