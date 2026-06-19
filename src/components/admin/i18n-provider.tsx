"use client";

import { createContext, useContext } from "react";
import { type Dict, t as translate } from "@/lib/i18n";

const Ctx = createContext<Dict>({});

// Wraps the admin tree with the active locale's dictionary so client components
// can translate via useT().
export function AdminI18nProvider({
  dict,
  children,
}: {
  dict: Dict;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={dict}>{children}</Ctx.Provider>;
}

export function useT() {
  const dict = useContext(Ctx);
  return (key: string) => translate(dict, key);
}
