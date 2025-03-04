import { Inter as FontSans } from "next/font/google";
import { cn } from "@/lib/utils/shadcn";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const nextTypography = cn(
  "min-h-screen bg-background font-sans antialiased",
  fontSans.variable,
);
