import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'id' | 'zh';
type Theme = 'light' | 'dark';

interface Translations {
  [key: string]: {
    en: string;
    id: string;
    zh: string;
  };
}

const translations: Translations = {
  appTitle: { en: "BESS Performance", id: "Performa BESS", zh: "BESS 性能" },
  uploadTitle: { en: "BESS Analytics Dashboard", id: "Dasbor Analitik BESS", zh: "BESS 分析仪表板" },
  uploadDesc: { en: "Upload your daily BESS logs to generate availability, power, and cycle insights.", id: "Unggah log BESS harian Anda untuk menghasilkan wawasan ketersediaan, daya, dan siklus.", zh: "上传您的每日BESS日志以生成可用性、功率和循环见解。" },
  step1: { en: "Upload Data", id: "Unggah Data", zh: "上传数据" },
  step2: { en: "Analyze Trends", id: "Analisa Tren", zh: "分析趋势" },
  step3: { en: "Export Reports", id: "Ekspor Laporan", zh: "导出报告" },
  
  // Filters
  filter_title: { en: "Data Filters", id: "Filter Data", zh: "数据筛选" },
  filter_dateRange: { en: "Date Range", id: "Rentang Tanggal", zh: "日期范围" },
  btn_filters: { en: "Filters", id: "Filter", zh: "筛选" },
  btn_reset: { en: "Reset", id: "Atur Ulang", zh: "重置" },

  // Generic
  label_actual: { en: "Actual", id: "Aktual", zh: "实际" },
  label_budget: { en: "Budget", id: "Anggaran", zh: "预算" },
};

interface ThemeLanguageContextType {
  theme: Theme;
  language: Language;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  chartColors: {
    grid: string;
    text: string;
    tooltipBg: string;
    tooltipText: string;
  };
}

const ThemeLanguageContext = createContext<ThemeLanguageContextType | undefined>(undefined);

export const ThemeLanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('light');
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const t = (key: string): string => {
    if (!translations[key]) return key;
    return translations[key][language] || key;
  };

  const chartColors = {
    grid: theme === 'dark' ? '#374151' : '#E5E7EB',
    text: theme === 'dark' ? '#9CA3AF' : '#6B7280',
    tooltipBg: theme === 'dark' ? '#1F2937' : '#FFFFFF',
    tooltipText: theme === 'dark' ? '#F3F4F6' : '#111827',
  };

  return (
    <ThemeLanguageContext.Provider value={{ theme, language, toggleTheme, setLanguage, t, chartColors }}>
      {children}
    </ThemeLanguageContext.Provider>
  );
};

export const useThemeLanguage = () => {
  const context = useContext(ThemeLanguageContext);
  if (!context) {
    throw new Error('useThemeLanguage must be used within a ThemeLanguageProvider');
  }
  return context;
};
