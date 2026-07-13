import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiSpec } from "@/lib/swagger";
import { ApiReference } from "./swagger-ui";

export const metadata = {
  title: "API reference",
  description: "OpenAPI reference for the Timbre API.",
};

export default function ApiDocPage() {
  // Generated at request time from the @swagger blocks in the route files.
  const spec = getApiSpec();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="font-heading text-base font-semibold tracking-tight">
              API reference
            </h1>
            <p className="text-xs text-muted-foreground">
              Generated from the route handlers themselves — it can&apos;t drift.
            </p>
          </div>
        </div>
      </header>

      {/* Swagger UI ships its own opinionated stylesheet; let it own this area. */}
      <div className="flex-1 bg-white">
        <ApiReference spec={spec} />
      </div>
    </div>
  );
}
