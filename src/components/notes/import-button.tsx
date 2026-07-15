"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Imports a `.vnote` bundle. Picks a file, POSTs it to the import route, and —
 * on success — opens the freshly-created note. A `.vnote` only opens through the
 * app (there's no OS handler for it), which is exactly the point of the format.
 */
export function ImportButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be picked again later
    if (!file) return;

    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/notes/import", {
        method: "POST",
        body: form,
      });

      if (res.status === 403) {
        toast.error("Importing would exceed your 5-minute voice budget.");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));

      const { note } = (await res.json()) as { note: { id: string } };
      toast.success("Note imported.");
      router.push(`/app/notes/${note.id}`);
    } catch {
      toast.error("Could not import that file. Is it a valid .vnote?");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".vnote,application/zip"
        className="hidden"
        onChange={onFile}
      />
      <Button
        variant="outline"
        disabled={importing}
        onClick={() => inputRef.current?.click()}
      >
        <Upload />
        {importing ? "Importing…" : "Import"}
      </Button>
    </>
  );
}
