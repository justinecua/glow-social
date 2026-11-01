import { createContext, useContext, useEffect, useState } from "react";

const initialState = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => null,
};

const ThemeProviderContext = createContext(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}) {
  const [theme, setTheme] = useState(() => localStorage.getItem(storageKey) || defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState("light");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const getSystemTheme = () => (mediaQuery.matches ? "dark" : "light");

    const updateThemeClass = (newTheme) => {
      root.classList.remove("light", "dark");
      const appliedTheme = newTheme === "system" ? getSystemTheme() : newTheme;
      root.classList.add(appliedTheme);
      root.style.colorScheme = appliedTheme;
      // Clear the pre-paint background set in index.html; CSS vars take over.
      root.style.removeProperty("background-color");
      setResolvedTheme(appliedTheme);
    };

    // Apply theme initially
    updateThemeClass(theme);

    // If system theme is being used, respond to system changes
    const handleSystemChange = () => {
      if (theme === "system") {
        updateThemeClass("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);

    setLoading(false);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [theme]);

  const value = {
    theme,
    resolvedTheme,
    setTheme: (newTheme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {!loading && children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (!context) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
