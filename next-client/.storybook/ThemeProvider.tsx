import React, { useEffect } from "react";
import { nextTypography } from "../src/lib/font";

const ThemeProvider = ({
  children,
  theme,
}: React.PropsWithChildren<{ theme: "light" | "dark" }>) => {
  document.body.className = document.body.className.concat(
    `, ${nextTypography}`,
  );
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
