import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  alignment?: "center" | "left";
  className?: string;
  subtitle?: string;
  title: string;
}

/**
 * Reusable section heading with accent underline.
 */
export function SectionHeading({ alignment = "center", className, subtitle, title }: SectionHeadingProps) {
  const isCentered = alignment === "center";

  return (
    <div className={cn(isCentered ? "mx-auto max-w-3xl text-center" : "max-w-3xl text-left", className)}>
      <h2 className="site-heading text-3xl font-semibold tracking-tight text-[var(--site-color-foreground)] md:text-4xl">
        {title}
      </h2>
      <div className={cn("mt-4 h-1 w-20 rounded-full bg-[var(--site-color-primary)]", isCentered ? "mx-auto" : "mx-0")} />
      {subtitle ? (
        <p className="mt-5 text-base text-[var(--site-color-muted-foreground)] md:text-lg">{subtitle}</p>
      ) : null}
    </div>
  );
}
