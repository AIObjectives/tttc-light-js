"use client";

import { usePathname } from "next/navigation";
import FrontFacingNavbar from "./FrontFacingNavbar";
import UserFacingNavbar from "./UserFacingNavbar";

// Routes that show the marketing / front-facing menu. Everything else gets the
// user-facing (app) menu. New marketing pages added later (e.g. /privacy) should
// be added here.
const FRONT_FACING_ROUTES = [
  "/",
  "/about",
  "/safety",
  "/product",
  "/pricing",
  "/help",
];

function isFrontFacing(pathname: string | null): boolean {
  if (!pathname) return true;
  return FRONT_FACING_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export default function NavbarRedesign() {
  const pathname = usePathname();
  return isFrontFacing(pathname) ? <FrontFacingNavbar /> : <UserFacingNavbar />;
}
