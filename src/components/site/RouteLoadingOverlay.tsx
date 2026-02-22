"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function shouldIgnoreAnchorClick(anchor: HTMLAnchorElement): boolean {
  const rawHref = anchor.getAttribute("href");
  if (!rawHref) return true;
  if (anchor.target && anchor.target !== "_self") return true;
  if (anchor.hasAttribute("download")) return true;
  if (
    rawHref.startsWith("mailto:") ||
    rawHref.startsWith("tel:") ||
    rawHref.startsWith("javascript:")
  ) {
    return true;
  }
  return false;
}

/**
 * Global loader for internal route transitions triggered by links/cards.
 */
export function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setIsLoading(false);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (shouldIgnoreAnchorClick(anchor)) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      const currentUrl = new URL(window.location.href);
      if (nextUrl.origin !== currentUrl.origin) return;

      const samePathAndQuery =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search;
      const sameHash = nextUrl.hash === currentUrl.hash;
      if (samePathAndQuery && sameHash) return;
      if (samePathAndQuery && !sameHash) return;

      setIsLoading(true);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setIsLoading(false);
        timeoutRef.current = null;
      }, 10000);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/35">
      <div className="h-11 w-11 animate-spin rounded-full border-4 border-white/35 border-t-[var(--site-color-primary)]" />
    </div>
  );
}
