'use client'

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const ThemeContext = createContext<{ theme: string }>({ theme: 'dark' });

export const ThemeProvider = ({ children, session }: { children: React.ReactNode; session: any }) => {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    if (!session?.id) return;

    const fetchTheme = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', session.id)
        .single();
        
      if (data && data.theme) {
        setTheme(data.theme);
        document.documentElement.setAttribute('data-theme', data.theme);
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    };

    fetchTheme();
  }, [session]);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);