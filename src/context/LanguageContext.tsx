"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Lang, T, Translations } from "@/lib/i18n";

interface LanguageContextType {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  t: T.en,
  toggleLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("bridge-lang") as Lang | null;
    if (saved === "en" || saved === "he") setLang(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);

  function toggleLang() {
    setLang((prev) => {
      const next = prev === "en" ? "he" : "en";
      localStorage.setItem("bridge-lang", next);
      return next;
    });
  }

  return (
    <LanguageContext.Provider value={{ lang, t: T[lang], toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
