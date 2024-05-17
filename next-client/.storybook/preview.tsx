import React, { useEffect } from "react";
import type { Preview } from "@storybook/react";
import ThemeProvider from "./ThemeProvider";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      description: "Global theme for components",
      defaultValue: "light",
      toolbar: {
        // The label to show for this toolbar item
        title: "Theme",
        icon: "circlehollow",
        // Array of plain string values or MenuItem shape (see below)
        items: ["light", "dark"],
        // Change title based on selected value
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      useEffect(() => {
        console.log(context.globals.theme);
      }, [context.globals.theme]);
      return (
        <ThemeProvider theme={context.globals.theme}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
