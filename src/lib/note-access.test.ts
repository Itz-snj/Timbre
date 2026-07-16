import { describe, expect, it } from "vitest";
import type { NoteDoc } from "@/lib/models";
import {
  accessFilter,
  isNoteOwner,
  noteRole,
  writeAccessFilter,
} from "@/lib/note-access";

/**
 * These filters and role checks are the server-side authorization boundary for
 * notes (ai_rules.md §2 rule 4, and the two-tier read/write split in
 * timbre's note-access module). A regression here means a viewer could write, or
 * a stranger could read — so they're worth pinning down explicitly.
 */

function note(overrides: Partial<NoteDoc> = {}): NoteDoc {
  return {
    title: "Untitled",
    noteType: "canvas",
    ownerId: "owner-uid",
    collaborators: [],
    shareEnabled: false,
    shareRole: "editor",
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("accessFilter (read access)", () => {
  it("matches the owner or any collaborator", () => {
    expect(accessFilter("u1")).toEqual({
      $or: [
        { ownerId: "u1" },
        { collaborators: { $elemMatch: { userId: "u1" } } },
      ],
    });
  });
});

describe("writeAccessFilter (write access)", () => {
  it("requires the editor role for collaborators — viewers are excluded", () => {
    expect(writeAccessFilter("u1")).toEqual({
      $or: [
        { ownerId: "u1" },
        { collaborators: { $elemMatch: { userId: "u1", role: "editor" } } },
      ],
    });
  });
});

describe("noteRole", () => {
  const shared = note({
    ownerId: "owner",
    collaborators: [
      { userId: "ed", role: "editor" },
      { userId: "vw", role: "viewer" },
    ],
  });

  it("returns 'owner' for the owner", () => {
    expect(noteRole(shared, "owner")).toBe("owner");
  });

  it("returns each collaborator's own role", () => {
    expect(noteRole(shared, "ed")).toBe("editor");
    expect(noteRole(shared, "vw")).toBe("viewer");
  });

  it("returns null for someone with no access", () => {
    expect(noteRole(shared, "stranger")).toBeNull();
  });
});

describe("isNoteOwner", () => {
  it("is true only for the owner's uid", () => {
    const n = note({ ownerId: "owner" });
    expect(isNoteOwner(n, "owner")).toBe(true);
    expect(isNoteOwner(n, "someone-else")).toBe(false);
  });
});
