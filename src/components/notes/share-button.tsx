"use client";

import { useState } from "react";
import { Check, Copy, Eye, Pencil, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Owner-only sharing control. Toggling on marks the note link-shared; anyone who
 * then opens the link joins as an editor (the join happens on the editor page).
 */
type ShareRole = "editor" | "viewer";

export function ShareButton({
  noteId,
  initialShareEnabled,
  initialShareRole,
}: {
  noteId: string;
  initialShareEnabled: boolean;
  initialShareRole: ShareRole;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(initialShareEnabled);
  const [role, setRole] = useState<ShareRole>(initialShareRole);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/app/notes/${noteId}`
      : "";

  async function update(next: boolean, nextRole: ShareRole) {
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next, role: nextRole }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        shareEnabled: boolean;
        shareRole: ShareRole;
      };
      setEnabled(data.shareEnabled);
      setRole(data.shareRole);
    } catch {
      toast.error("Could not update sharing. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 />
        Share
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this note</DialogTitle>
            <DialogDescription>
              Let others open and edit this note with you in real time.
            </DialogDescription>
          </DialogHeader>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3">
            <span className="text-sm">
              <span className="font-medium">Anyone with the link</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Turn on to let people open this note from a link.
              </span>
            </span>
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy}
              onChange={(event) => update(event.target.checked, role)}
              className="size-4 shrink-0 accent-brand"
              aria-label="Share via link"
            />
          </label>

          {enabled ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <RoleOption
                  active={role === "editor"}
                  disabled={busy}
                  onClick={() => update(true, "editor")}
                  icon={<Pencil className="size-4" />}
                  label="Can edit"
                  hint="Draw, type, record"
                />
                <RoleOption
                  active={role === "viewer"}
                  disabled={busy}
                  onClick={() => update(true, "viewer")}
                  icon={<Eye className="size-4" />}
                  label="Can view"
                  hint="Read-only, no edits"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border bg-muted px-2.5 py-2 text-xs text-muted-foreground"
                  aria-label="Share link"
                />
                <Button variant="outline" size="sm" onClick={copy}>
                  <span className={cn(copied && "text-canvas")}>
                    {copied ? <Check /> : <Copy />}
                  </span>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RoleOption({
  active,
  disabled,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:opacity-50",
        active
          ? "border-brand bg-brand-muted"
          : "hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          active && "text-brand",
        )}
      >
        {icon}
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
