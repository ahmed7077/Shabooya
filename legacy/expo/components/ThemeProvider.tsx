import { PropsWithChildren, createContext, useContext } from "react";
import { useColorScheme } from "react-native";

const palettes = {
  light: {
    background: "#F8FAFC",
    surface: "#FFFFFF",
    text: "#0F172A",
    muted: "#64748B",
    primary: "#0F766E",
    danger: "#B91C1C",
    warning: "#B45309",
    border: "#E2E8F0",
  },
  dark: {
    background: "#0B1120",
    surface: "#111827",
    text: "#F8FAFC",
    muted: "#CBD5E1",
    primary: "#2DD4BF",
    danger: "#FCA5A5",
    warning: "#FCD34D",
    border: "#334155",
  },
};

const ThemeContext = createContext(palettes.light);

export function ThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  return <ThemeContext.Provider value={palettes[scheme === "dark" ? "dark" : "light"]}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
