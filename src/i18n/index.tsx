import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type {
  Locale,
  LocalizableFields,
  FieldType,
} from "./types";

export type { Locale, LocalizableFields, FieldType } from "./types";

import { ruDictionary } from "./locales/ru";
import { kkDictionary } from "./locales/kk";

const dictionaries = {
  ru: ruDictionary,
  kk: kkDictionary,
} as const;

export type TranslationKey = keyof typeof ruDictionary;

export type TFunction = (key: string) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "edms.locale";

function getBrowserLocale(): Locale {
  if (typeof window === "undefined") {
    return "ru";
  }

  return navigator.language.startsWith("kk")
    ? "kk"
    : "ru";
}

function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }

  const locale = localStorage.getItem(STORAGE_KEY);

  if (locale === "ru" || locale === "kk") {
    return locale;
  }

  return null;
}

export function I18nProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    () => getStoredLocale() ?? getBrowserLocale(),
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, nextLocale);
    }
  }, []);

  const t = useCallback<TFunction>(
    (key) => {
      const dict = dictionaries[locale];

      return (
        dict[key as keyof typeof dict] ??
        ruDictionary[key as keyof typeof ruDictionary] ??
        key
      );
    },
    [locale],
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error(
      "useI18n must be used within I18nProvider",
    );
  }

  return context;
}

export function localized<T extends LocalizableFields>(
  obj: T | null | undefined,
  locale: Locale,
  field: FieldType,
): string {
  if (!obj) {
    return "";
  }

  const localizedValue =
    obj[`${field}_${locale}` as keyof T];

  if (
    typeof localizedValue === "string" &&
    localizedValue.length > 0
  ) {
    return localizedValue;
  }

  const fallbackValue =
    obj[`${field}_ru` as keyof T];

  if (
    typeof fallbackValue === "string" &&
    fallbackValue.length > 0
  ) {
    return fallbackValue;
  }

  return "";
}

export function createLocalizer(locale: Locale) {
  return <T extends LocalizableFields>(
    obj: T | null | undefined,
    field: FieldType,
  ): string => {
    return localized(obj, locale, field);
  };
}