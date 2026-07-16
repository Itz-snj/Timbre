import { describe, expect, it } from "vitest";
import {
  remapDocumentVoiceIds,
  vnoteFilename,
  vnoteManifestSchema,
} from "@/lib/vnote";

describe("remapDocumentVoiceIds", () => {
  const idMap = new Map([["old-1", "new-1"]]);

  it("rewrites voiceNoteId on nested blocks without mutating the input", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hi" }] },
        { type: "voiceNote", attrs: { voiceNoteId: "old-1" } },
      ],
    };

    expect(remapDocumentVoiceIds(doc, idMap)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hi" }] },
        { type: "voiceNote", attrs: { voiceNoteId: "new-1" } },
      ],
    });

    // The original tree must be untouched (the function returns a new tree).
    expect(doc.content[1].attrs?.voiceNoteId).toBe("old-1");
  });

  it("leaves a voiceNoteId with no mapping unchanged", () => {
    const block = { type: "voiceNote", attrs: { voiceNoteId: "unmapped" } };
    expect(remapDocumentVoiceIds(block, idMap)).toEqual(block);
  });

  it("passes non-object content straight through", () => {
    expect(remapDocumentVoiceIds(null, idMap)).toBeNull();
    expect(remapDocumentVoiceIds("text", idMap)).toBe("text");
  });
});

describe("vnoteFilename", () => {
  it("slugifies a plain title", () => {
    expect(vnoteFilename("Sprint Planning")).toBe("sprint-planning.vnote");
  });

  it("collapses punctuation and trims leading/trailing dashes", () => {
    expect(vnoteFilename("  Q3 — Goals!! ")).toBe("q3-goals.vnote");
  });

  it("falls back to 'note' when nothing survives slugification", () => {
    expect(vnoteFilename("——")).toBe("note.vnote");
  });
});

describe("vnoteManifestSchema", () => {
  const base = {
    version: "2.0",
    type: "vnote-bundle" as const,
    noteType: "document" as const,
    meta: { title: "My note" },
  };

  it("applies defaults for the optional sections", () => {
    const parsed = vnoteManifestSchema.parse(base);
    expect(parsed.voiceNotes).toEqual([]);
    expect(parsed.canvas).toBeNull();
    expect(parsed.document).toBeNull();
  });

  it("rejects a manifest with the wrong type literal", () => {
    expect(
      vnoteManifestSchema.safeParse({ ...base, type: "not-a-vnote" }).success,
    ).toBe(false);
  });

  it("fills per-voice-note defaults (title/position null, default mime)", () => {
    const parsed = vnoteManifestSchema.parse({
      ...base,
      voiceNotes: [
        { audioFile: "audio/vn_1.webm", originalId: "v1", durationSec: 12 },
      ],
    });
    expect(parsed.voiceNotes[0]).toMatchObject({
      title: null,
      position: null,
      mimeType: "audio/webm",
    });
  });
});
