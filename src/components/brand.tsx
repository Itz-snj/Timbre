import Link from "next/link";
import { cn } from "@/lib/utils";
import { site } from "@/lib/site";

/** Wordmark. The glyph is a waveform folded into a note page — voice as content. */
export function Brand({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-md font-heading text-lg font-semibold tracking-tight",
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M5 10v4M9 6v12M13 8.5v7M17 11v2" />
        </svg>
      </span>
      {site.name}
    </Link>
  );
}
