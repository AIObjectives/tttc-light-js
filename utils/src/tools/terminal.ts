import * as fs from "fs-extra";
import readline from "readline";

export const clearScreen = () =>
  fs.writeFileSync(
    process.stdout.fd,
    new TextEncoder().encode("\x1b[2J\x1b[H"),
  );

/**
 * Simple terminal reader that returns any input
 *
 * Example use:
 *
 * const result = await reader("some prompt")
 */
export const reader = (prompt: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

/**
 * Creates a select menu in terminal
 *
 * example:
 * const options = ['Option 1', 'Option 2', 'Option 3', 'Exit'];
 * const prompt = 'Use arrow keys to select an option and press Enter:'
 *
 * const result = await select(prompt, options);
 * console.log(`You selected: ${result}`)
 *
 * ! Warning:
 *  This might affect terminal env state.
 *  If this becomes a problem - refactor to become pure.
 */
export async function select<SelectOption extends string>(
  prompt: string,
  options: readonly SelectOption[],
): Promise<SelectOption> {
  // Verify we're in a terminal
  if (!process.stdin.isTTY) {
    throw new Error("This script requires a terminal to run");
  }

  let selectedIndex = 0;
  // const encoder = new TextEncoder();

  // Helper to render the menu
  const renderMenu = () => {
    // Move cursor up and clear
    process.stdout.write("\x1B[" + (options.length + 1) + "A"); // Move up
    process.stdout.write("\x1B[J"); // Clear below

    // Print menu
    process.stdout.write(prompt + "\n");
    options.forEach((option, i) => {
      const prefix = i === selectedIndex ? "> " : "  ";
      process.stdout.write(`${prefix}${option}\n`);
    });
  };

  try {
    // Configure stdin
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    // Initial render
    console.log(prompt);
    options.forEach((option, i) => {
      const prefix = i === selectedIndex ? "> " : "  ";
      console.log(`${prefix}${option}`);
    });

    return new Promise((resolve) => {
      // Handle keypress events
      process.stdin.on("data", (data) => {
        const key = data.toString();

        if (key === "\u001B[A") {
          // Up arrow
          selectedIndex = (selectedIndex - 1 + options.length) % options.length;
          renderMenu();
        } else if (key === "\u001B[B") {
          // Down arrow
          selectedIndex = (selectedIndex + 1) % options.length;
          renderMenu();
        } else if (key === "\r") {
          // Enter
          // Clean up
          process.stdin.removeAllListeners("data");
          process.stdin.setRawMode(false);
          process.stdin.pause();

          // Move cursor to bottom and resolve
          process.stdout.write("\x1B[" + options.length + "B");
          resolve(options[selectedIndex]);
        } else if (key === "\u0003") {
          // Ctrl+C
          process.exit();
        }
      });
    });
  } catch (error) {
    // Ensure we clean up even if there's an error
    process.stdin.setRawMode(false);
    process.stdin.pause();
    throw error;
  }
}
