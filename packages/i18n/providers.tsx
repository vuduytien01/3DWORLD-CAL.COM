"use client";

import { createContext, useMemo } from "react";
import type { ReactNode } from "react";

type I18nContextType = {
  translations: Record<string, string>;
  ns: string;
  locale: string;
};

export const AppRouterI18nContext = createContext<I18nContextType | null>(null);
export const CustomI18nContext = createContext<I18nContextType | null>(null);

export function AppRouterI18nProvider({
  children,
  translations,
  locale,
  ns,
}: I18nContextType & {
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      translations,
      locale,
      ns,
    }),
    [locale, ns]
  );

  return <AppRouterI18nContext.Provider value={value}>{children}</AppRouterI18nContext.Provider>;
}

export function CustomI18nProvider({
  children,
  translations,
  locale,
  ns,
}: I18nContextType & {
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      translations,
      locale,
      ns,
    }),
    [locale, ns]
  );

  return <CustomI18nContext.Provider value={value}>{children}</CustomI18nContext.Provider>;
}