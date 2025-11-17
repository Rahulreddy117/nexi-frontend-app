// ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

const getThemeColors = (mode: ThemeMode) => {
  if (mode === 'light') {
    return {
      active: '#333',
      inactive: 'gray',
      tabBarBackground: '#fff',
      iconColor: '#333',
      background: '#fff',
      text: '#333',
      secondaryText: '#666',
      placeholderBackground: '#e0e0e0',
      placeholderText: '#666',
      border: '#ddd',
      accent: '#666',
      buttonText: '#fff',
      notificationBg: 'rgba(99, 102, 241, 0.1)', // light indigo tint


    };
  } else {
    return {
      active: '#fff',
      inactive: '#888',
      tabBarBackground: '#0A0A0A',
      iconColor: '#fff',
      background: '#000',
      text: '#fff',
      secondaryText: '#888',
      placeholderBackground: '#333',
      placeholderText: '#888',
      border: '#333',
      accent: '#333',
      buttonText: '#fff',
      primary: '#0A84FF', 
      card: '#1C1C1E',
      notificationBg: 'rgba(99, 102, 241, 0.2)',
    };
  }
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ReturnType<typeof getThemeColors>;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme) setMode(savedTheme as ThemeMode);
      } catch (error) {
        console.log('Failed to load theme:', error);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newMode: ThemeMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    try {
      await AsyncStorage.setItem('theme', newMode);
    } catch (error) {
      console.log('Failed to save theme:', error);
    }
  };

  const colors = getThemeColors(mode);

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
