/**
 * Slim announcement eyebrow strip — Miro's keynote promo-strip analog.
 * Full-width, brand-muted background, centered text. Server component.
 */
import { site } from "@/lib/site";

export function AnnouncementBar() {
  return (
    <div
      role="banner"
      aria-label="Announcement"
      className="border-b bg-brand-muted"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center px-6 py-2.5">
        <p className="text-center text-sm font-medium text-brand">
          <span className="mr-1.5 text-brand/60">✦</span>
          {site.landing.announcement}
        </p>
      </div>
    </div>
  );
}
