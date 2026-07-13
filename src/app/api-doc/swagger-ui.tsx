"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

/**
 * swagger-ui-react touches `window` on import and still ships React 18-era
 * lifecycle internals, so it's loaded client-side only (`ssr: false`) — which
 * also keeps its considerable bundle off every other page.
 */
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <p className="p-8 text-sm text-muted-foreground">Loading API reference…</p>
  ),
});

export function ApiReference({ spec }: { spec: Record<string, unknown> }) {
  return <SwaggerUI spec={spec} />;
}
