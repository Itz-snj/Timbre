"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  MoreHorizontal,
  Pencil,
  Shapes,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NOTE_TITLE_MAX } from "@/lib/models";
import type { NoteSummary } from "@/lib/notes";
import { cn } from "@/lib/utils";

/** "just now" / "3 hours ago" / "on 12 Jul" — a note list reads by recency, not timestamps. */
function formatEdited(iso: string): string {
  const then = new Date(iso);
  const seconds = Math.round((Date.now() - then.getTime()) / 1000);

  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return `on ${then.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

const TYPE_META = {
  canvas: {
    label: "Canvas",
    Icon: Shapes,
    // Domain colour tokens (globals.css §7): a card's type reads at a glance.
    badge: "bg-canvas-muted text-canvas",
    icon: "text-canvas",
  },
  document: {
    label: "Document",
    Icon: FileText,
    badge: "bg-document-muted text-document",
    icon: "text-document",
  },
} as const;

export function NoteCard({ note }: { note: NoteSummary }) {
  const router = useRouter();
  const meta = TYPE_META[note.noteType];

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && trimmed !== note.title && !isSaving;

  async function handleRename(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error(`Rename failed (${res.status})`);

      toast.success("Note renamed.");
      setRenameOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not rename the note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      // 404 means it's already gone — treat that as success, the goal is reached.
      if (!res.ok && res.status !== 404) {
        throw new Error(`Delete failed (${res.status})`);
      }

      toast.success("Note deleted.");
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not delete the note. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="group relative flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-brand/40">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              meta.badge,
            )}
          >
            <meta.Icon className="size-3.5" aria-hidden="true" />
            {meta.label}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                aria-label={`Actions for ${note.title}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onSelect={() => {
                  setTitle(note.title);
                  setRenameOpen(true);
                }}
              >
                <Pencil />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-heading text-lg font-medium tracking-tight">
            {note.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Edited {formatEdited(note.updatedAt)}
          </p>
        </div>
      </div>

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Rename note</DialogTitle>
              <DialogDescription>
                Give this {meta.label.toLowerCase()} note a new title.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 py-4">
              <Label htmlFor={`rename-${note.id}`}>Title</Label>
              <Input
                id={`rename-${note.id}`}
                value={title}
                maxLength={NOTE_TITLE_MAX}
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSave}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{note.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the note. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Keep the dialog open while the request is in flight; close on success.
                event.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
