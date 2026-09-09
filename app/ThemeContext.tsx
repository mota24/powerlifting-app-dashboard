'use client'

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import type { ModeApp } from '@/lib/powerlifting';
import { traducteurPour, LOCALES, type Langue } from '@/lib/i18n';

export type { Langue };
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

/** Traducteur lié à la langue du profil courant. */
export const useT = () => {
  const { langue } = useContext(ThemeContext);
  return useMemo(() => traducteurPour(langue), [langue]);
};

/** Étiquette de locale, pour les dates et les nombres. */
export const useLocale = () => LOCALES[useContext(ThemeContext).langue];
