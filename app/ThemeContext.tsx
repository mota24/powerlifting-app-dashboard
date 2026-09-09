'use client'

import React, { createContext, useContext, useEffect } from 'react';
import type { ModeApp } from '@/lib/powerlifting';

type EtatProfil = { theme: string; mode: ModeApp };

const ThemeContext = createContext<EtatProfil>({ theme: 'dark', mode: 'powerlifting' });

/**
 * Applique le thème sur <html> et met le profil à disposition de l'arbre.
 * Le profil est chargé par la page (une seule requête) et passé ici.
 */
export const ThemeProvider = ({
  children,
  theme = 'dark',
  mode = 'powerlifting',
}: {
  children: React.ReactNode;
  theme?: string;
  mode?: ModeApp;
}) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, mode }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
