import Link from "next/link";
import { site } from "@/lib/site";

/** Name + GitHub + LinkedIn are required by the assignment's submission guidelines. */
export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Built by{" "}
          <span className="font-medium text-foreground">{site.author.name}</span>
          <span className="mx-1.5 font-mono text-xs text-brand/70">itz-snj</span>
          {" · "}
          <Link
            href="/api-doc"
            className="rounded underline-offset-4 hover:underline"
          >
            API docs
          </Link>
        </p>

        <nav aria-label="Author links" className="flex items-center gap-5">
          <a
            href={site.author.github}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            GitHub
          </a>
          <a
            href={site.author.linkedin}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            LinkedIn
          </a>
        </nav>
      </div>
    </footer>
  );
}
