import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "./translations";

const STORAGE_KEY = "app_language";
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "fr" || saved === "en" || saved === "ar" ? saved : "en";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo(() => {
    const t = (key) => translations[language]?.[key] ?? translations.en[key] ?? key;
    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
