"use client";

import { useEffect, useMemo } from "react";
import { getThemeStyle } from "@/lib/themes";

export function useThemeStyle(themeKey: string | null | undefined) {
  const themeStyle = useMemo(() => getThemeStyle(themeKey), [themeKey]);

  useEffect(() => {
    const root = document.documentElement;
    const entries = Object.entries(themeStyle);
    const previousValues = entries.map(([property]) => [property, root.style.getPropertyValue(property)] as const);

    entries.forEach(([property, value]) => {
      root.style.setProperty(property, String(value));
    });

    return () => {
      previousValues.forEach(([property, value]) => {
        if (value) {
          root.style.setProperty(property, value);
          return;
        }

        root.style.removeProperty(property);
      });
    };
  }, [themeStyle]);

  return themeStyle;
}
