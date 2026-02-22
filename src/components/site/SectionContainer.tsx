import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionContainerProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * Shared responsive container for site sections.
 */
export function SectionContainer({ children, className, id }: SectionContainerProps) {
  return (
    <section className={cn("mx-auto w-full max-w-[1180px] px-4 md:px-8", className)} id={id}>
      {children}
    </section>
  );
}
