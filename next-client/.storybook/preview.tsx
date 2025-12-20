import type { Preview } from "@storybook/react";
import ThemeProvider from "./ThemeProvider";
import "../src/app/global.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        {
          name: "light",
          value: "#FFFFFF",
        },
        {
          name: "dark",
          value: "#09090B",
        },
      ],
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
      return (
        <ThemeProvider theme={context.globals.theme}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
