import type { CSSProperties } from "react";
import type { ThemeOption } from "@/lib/types";

export const themes: ThemeOption[] = [
  { id: "mireva", name: "Mireva", description: "Branco com laranja Mireva.", colors: ["#ffffff", "#fca311", "#fff0c2"] },
  { id: "essencial", name: "Essencial", description: "Claro com azul acinzentado.", colors: ["#ffffff", "#64748b", "#eef2f7"] },
  { id: "premium", name: "Premium", description: "Grafite com dourado suave.", colors: ["#22252a", "#d6a84f", "#f7f2e8"] },
  { id: "calmo", name: "Calmo", description: "Branco com verde suave.", colors: ["#ffffff", "#2aa7a0", "#dff7f3"] },
  { id: "editorial", name: "Editorial", description: "Neutro com vinho discreto.", colors: ["#fbf7ef", "#8a4b5b", "#ead9bb"] },
];

type ThemeTokens = {
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  chart2: string;
};

const themeTokens: Record<string, ThemeTokens> = {
  mireva: {
    primary: "#fca311",
    primaryForeground: "#0f082b",
    background: "#fffaf1",
    foreground: "#0f172a",
    card: "#ffffff",
    cardForeground: "#0f172a",
    secondary: "#fff3df",
    secondaryForeground: "#0f082b",
    muted: "#fff8ed",
    mutedForeground: "#64748b",
    accent: "#fff0c2",
    accentForeground: "#0f082b",
    border: "#f2dfbd",
    input: "#e8c98e",
    chart2: "#f9cb72",
  },
  essencial: {
    primary: "#64748b",
    primaryForeground: "#ffffff",
    background: "#f8fafc",
    foreground: "#0f172a",
    card: "#ffffff",
    cardForeground: "#0f172a",
    secondary: "#eef2f7",
    secondaryForeground: "#0f172a",
    muted: "#f1f5f9",
    mutedForeground: "#64748b",
    accent: "#e2e8f0",
    accentForeground: "#0f172a",
    border: "#cbd5e1",
    input: "#cbd5e1",
    chart2: "#94a3b8",
  },
  premium: {
    primary: "#d6a84f",
    primaryForeground: "#171717",
    background: "#fcfaf5",
    foreground: "#171717",
    card: "#ffffff",
    cardForeground: "#171717",
    secondary: "#f7f2e8",
    secondaryForeground: "#171717",
    muted: "#f5efe4",
    mutedForeground: "#685f50",
    accent: "#ead9bb",
    accentForeground: "#171717",
    border: "#dfc997",
    input: "#dfc997",
    chart2: "#22252a",
  },
  calmo: {
    primary: "#2aa7a0",
    primaryForeground: "#ffffff",
    background: "#f8fffd",
    foreground: "#0f172a",
    card: "#ffffff",
    cardForeground: "#0f172a",
    secondary: "#dff7f3",
    secondaryForeground: "#0f172a",
    muted: "#ecfbf8",
    mutedForeground: "#5b716f",
    accent: "#c9f0eb",
    accentForeground: "#0f172a",
    border: "#bde8e2",
    input: "#bde8e2",
    chart2: "#7dd3c7",
  },
  editorial: {
    primary: "#8a4b5b",
    primaryForeground: "#ffffff",
    background: "#fbf7ef",
    foreground: "#171717",
    card: "#ffffff",
    cardForeground: "#171717",
    secondary: "#f4e9d6",
    secondaryForeground: "#171717",
    muted: "#f6efe4",
    mutedForeground: "#76695a",
    accent: "#ead9bb",
    accentForeground: "#171717",
    border: "#e2cfad",
    input: "#e2cfad",
    chart2: "#a56270",
  },
};

export function getBusinessTheme(themeKey: string | null | undefined) {
  return themeTokens[themeKey ?? ""] ?? themeTokens.mireva;
}

export function getThemeStyle(themeKey: string | null | undefined): CSSProperties {
  const theme = getBusinessTheme(themeKey);

  return {
    "--background": theme.background,
    "--foreground": theme.foreground,
    "--card": theme.card,
    "--card-foreground": theme.cardForeground,
    "--popover": theme.card,
    "--popover-foreground": theme.cardForeground,
    "--primary": theme.primary,
    "--primary-foreground": theme.primaryForeground,
    "--secondary": theme.secondary,
    "--secondary-foreground": theme.secondaryForeground,
    "--muted": theme.muted,
    "--muted-foreground": theme.mutedForeground,
    "--accent": theme.accent,
    "--accent-foreground": theme.accentForeground,
    "--border": theme.border,
    "--input": theme.input,
    "--ring": theme.primary,
    "--chart-1": theme.primary,
    "--chart-2": theme.chart2,
    "--chart-3": theme.primary,
    "--sidebar": theme.card,
    "--sidebar-foreground": theme.foreground,
    "--sidebar-primary": theme.primary,
    "--sidebar-primary-foreground": theme.primaryForeground,
    "--sidebar-accent": theme.secondary,
    "--sidebar-accent-foreground": theme.secondaryForeground,
    "--sidebar-border": theme.border,
    "--sidebar-ring": theme.primary,
  } as CSSProperties;
}
