"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Mic } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/firebase/client";
import { VOICE_BUDGET_SECONDS } from "@/lib/models";

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** mm:ss — the voice budget always reads as a duration, never a raw second count. */
function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function UserMenu({
  name,
  email,
  photoURL,
  totalVoiceSeconds,
}: {
  name: string | null;
  email: string | null;
  photoURL: string | null;
  totalVoiceSeconds: number;
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const used = Math.min(totalVoiceSeconds, VOICE_BUDGET_SECONDS);
  const usedPercent = (used / VOICE_BUDGET_SECONDS) * 100;
  const isNearLimit = usedPercent >= 80;

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setIsSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Account menu"
      >
        <Avatar className="size-9 border">
          {photoURL ? <AvatarImage src={photoURL} alt="" /> : null}
          <AvatarFallback className="bg-brand-muted text-xs font-medium text-brand">
            {initials(name, email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{name ?? "Signed in"}</p>
          {email ? (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Voice budget (ai_rules.md §9). Shown wherever the user can record, so
            running out is never a surprise 403 mid-recording. */}
        <div className="px-2 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Mic className="size-3" />
              Voice used
            </span>
            <span
              className={`font-mono tabular-nums ${
                isNearLimit ? "text-record" : "text-muted-foreground"
              }`}
            >
              {formatDuration(used)} / {formatDuration(VOICE_BUDGET_SECONDS)}
            </span>
          </div>

          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(usedPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Voice recording budget used"
          >
            <div
              className={`h-full rounded-full transition-all ${
                isNearLimit ? "bg-record" : "bg-brand"
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
          <LogOut className="size-4" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
