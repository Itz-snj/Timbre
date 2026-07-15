"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Shapes } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteType } from "@/lib/models";

/**
 * "New note" entry point. The one decision forced at creation is the note type
 * (ai_rules.md §4) — canvas vs. document — so this is a menu of exactly those
 * two, not a form. The note is created with a default title; the user renames it
 * from the card afterwards.
 *
 * Once the editors exist (Phases 2–3) this will navigate into the new note; for
 * now it refreshes the list so the created card appears in place.
 */
export function NewNoteButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  async function createNote(noteType: NoteType) {
    setIsCreating(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteType }),
      });

      if (!res.ok) throw new Error(`Create failed (${res.status})`);

      toast.success(`New ${noteType} note created.`);
      router.refresh();
    } catch {
      toast.error("Could not create the note. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={isCreating}>
          <Plus />
          {isCreating ? "Creating…" : "New note"}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Choose a note type
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => createNote("canvas")}
          disabled={isCreating}
        >
          <Shapes className="text-canvas" />
          <div className="flex flex-col">
            <span className="font-medium">Canvas</span>
            <span className="text-xs text-muted-foreground">
              Sketch and arrange freely
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => createNote("document")}
          disabled={isCreating}
        >
          <FileText className="text-document" />
          <div className="flex flex-col">
            <span className="font-medium">Document</span>
            <span className="text-xs text-muted-foreground">
              Write in linear blocks
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
