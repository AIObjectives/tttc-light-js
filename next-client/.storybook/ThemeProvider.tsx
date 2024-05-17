import React, { useEffect } from "react";

const ThemeProvider = ({
  children,
  theme,
}: React.PropsWithChildren<{ theme: "light" | "dark" }>) => {
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
