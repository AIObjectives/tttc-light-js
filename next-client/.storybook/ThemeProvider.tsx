import type React from "react";
import { useEffect } from "react";
import { nextTypography } from "../src/lib/font";

const ThemeProvider = ({
  children,
  theme,
}: React.PropsWithChildren<{ theme: "light" | "dark" }>) => {
  document.body.className =
    document.body.className +
    `${document.body.className.includes(nextTypography) ? "" : nextTypography}`;
  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [theme]);
  return children;
};

export default ThemeProvider;
