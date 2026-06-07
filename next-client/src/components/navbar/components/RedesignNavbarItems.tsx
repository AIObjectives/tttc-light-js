"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Icons from "@/assets/icons";
import {
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/elements";
import { Col } from "@/components/layout";
import { useUserQuery } from "@/lib/query/useUserQuery";

export function RedesignLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Home">
      <Icons.Logo className="inline-block" />
      <Icons.TTTC className="inline-block" />
    </Link>
  );
}

export function FrontFacingNavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-[16px] leading-6 text-foreground hover:underline whitespace-nowrap"
    >
      {label}
    </Link>
  );
}

// "Home" link in the front-facing menu: logged-in → /my-reports; logged-out
// → triggers the existing LoginButton sign-in dialog via the ?action=signin
// query param that LoginButton already listens for.
export function FrontFacingHomeLink() {
  const { user, loading } = useUserQuery();
  if (loading) return null;
  const href = user ? "/my-reports" : "?action=signin";
  return <FrontFacingNavLink href={href} label="Home" />;
}

// Buttons used in the user-facing (app) menu. Highlighted variant when the
// current route matches.
function AppNavButton({
  href,
  label,
  matchPrefix,
}: {
  href: string;
  label: string;
  matchPrefix: string;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === matchPrefix || pathname.startsWith(`${matchPrefix}/`);
  return (
    <Button
      asChild
      variant={isActive ? "secondary" : "outline"}
      className="h-10 px-4 py-2 rounded-md font-medium text-[14px]"
    >
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function StudiesButton() {
  return (
    <AppNavButton href="/studies" label="Studies" matchPrefix="/studies" />
  );
}

export function ReportsButton() {
  return (
    <AppNavButton
      href="/my-reports"
      label="Reports"
      matchPrefix="/my-reports"
    />
  );
}

export function VerticalDivider({ className = "" }: { className?: string }) {
  return <div className={`bg-border h-[25px] w-px ${className}`} aria-hidden />;
}

type MobileLink = { href: string; label: string };

export function RedesignMobileMenu({ links }: { links: MobileLink[] }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Sheet modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? (
            <Icons.X className="size-6" />
          ) : (
            <Icons.Menu className="size-6" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-[80vh] p-6 pt-12"
        aria-describedby={undefined}
        hideCloseButton
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <Col className="h-full">
          {links.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="py-2 px-3 min-h-[44px] flex items-center w-full rounded-md hover:bg-accent hover:text-primary"
            >
              <p>{link.label}</p>
            </Link>
          ))}
        </Col>
      </SheetContent>
    </Sheet>
  );
}
