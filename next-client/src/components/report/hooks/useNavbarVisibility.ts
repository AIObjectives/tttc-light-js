import { useEffect, useState } from "react";

interface NavbarVisibilityState {
  isVisible: boolean;
  height: number;
}

export function useNavbarVisibility(): NavbarVisibilityState {
  const [navbarState, setNavbarState] = useState<NavbarVisibilityState>({
    isVisible: true,
    height: 64, // Default navbar height (h-16 = 64px)
  });

  useEffect(() => {
    let lastScrollY = 0;
    let ticking = false;

    const updateNavbarVisibility = () => {
      const scrollY = window.scrollY;
      const navbar = document.querySelector("[data-navbar]") as HTMLElement;

      if (navbar) {
        const navbarRect = navbar.getBoundingClientRect();
        const isVisible = navbarRect.bottom > 0;
        const height = navbarRect.height;

        setNavbarState((prev) => {
          if (prev.isVisible !== isVisible || prev.height !== height) {
            return { isVisible, height };
          }
          return prev;
        });
      }

      lastScrollY = scrollY;
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateNavbarVisibility);
        ticking = true;
      }
    };

    const handleResize = () => {
      updateNavbarVisibility();
    };

    // Initial check
    updateNavbarVisibility();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return navbarState;
}
