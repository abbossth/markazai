"use client";

import { createContext, useContext, useState } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/** Markaz sozlamalaridan kelgan, mijoz komponentlari kerak bo'ladigan qiymatlar (yoqilgan tillar, nom, logotip). */
export type CenterClientConfig = { name: string; logoUrl: string | null; locales: string[]; defaultTheme: string };
const CenterContext = createContext<CenterClientConfig>({ name: "Markazai", logoUrl: null, locales: ["uz", "ru", "en"], defaultTheme: "system" });
export const useCenterConfig = () => useContext(CenterContext);

export function Providers({ children, config }: { children: React.ReactNode; config: CenterClientConfig }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } }),
  );

  return (
    <CenterContext.Provider value={config}>
      <ThemeProvider attribute="class" defaultTheme={config.defaultTheme} enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </ThemeProvider>
    </CenterContext.Provider>
  );
}
