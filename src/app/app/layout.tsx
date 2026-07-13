import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { requireUser, UnauthorizedError } from "@/lib/auth";

/**
 * Shell for the authenticated app.
 *
 * `proxy.ts` already redirected signed-out visitors before they got here, but we
 * call `requireUser()` again rather than trusting that — proxy is a UX redirect,
 * not the authorization boundary (see lib/auth.ts). It also lazily upserts the
 * Mongo `users` row, so the first thing a new user does is create their record.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/?reason=auth");
    throw error;
  }

  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Brand href="/app" />
          <UserMenu
            name={user.name}
            email={user.email}
            photoURL={user.photoURL}
            totalVoiceSeconds={user.totalVoiceSeconds}
          />
        </div>
      </header>

      <main id="app-main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
