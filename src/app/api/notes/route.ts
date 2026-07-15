import { NextResponse } from "next/server";
import {
  currentUser,
  parseJsonBody,
  unauthorized,
} from "@/lib/api";
import { notesCollection } from "@/lib/mongodb";
import {
  createNoteSchema,
  defaultTitle,
  toNoteSummary,
} from "@/lib/notes";
import type { NoteDoc } from "@/lib/models";

// Reads the session cookie and queries Mongo per request — never prerender.
export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/notes:
 *   get:
 *     tags: [Notes]
 *     summary: List the signed-in user's notes
 *     description: >
 *       Returns every note owned by the current user, most recently updated
 *       first. Each entry is a lightweight summary — title, type, timestamps —
 *       without the canvas or document body, which the editor fetches separately.
 *     responses:
 *       200:
 *         description: The user's notes, newest edit first.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       title: { type: string }
 *                       noteType: { type: string, enum: [canvas, document] }
 *                       ownerId: { type: string }
 *                       isPublic: { type: boolean }
 *                       createdAt: { type: string, format: date-time }
 *                       updatedAt: { type: string, format: date-time }
 *       401:
 *         description: No valid session cookie.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();

  const notes = await notesCollection();
  const docs = await notes
    .find({ ownerId: user.firebaseUid })
    .sort({ updatedAt: -1 })
    .toArray();

  return NextResponse.json({ notes: docs.map(toNoteSummary) });
}

/**
 * @swagger
 * /api/notes:
 *   post:
 *     tags: [Notes]
 *     summary: Create an empty note
 *     description: >
 *       Creates a new note owned by the current user. The note type — canvas or
 *       document — is chosen here and is fixed for the note's lifetime. A title
 *       is optional; when omitted the note gets a type-based default the user can
 *       rename later. The note starts empty; its editor content is filled in by
 *       the canvas/document editors in later phases.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [noteType]
 *             properties:
 *               noteType:
 *                 type: string
 *                 enum: [canvas, document]
 *                 description: Which editor the note opens in.
 *               title:
 *                 type: string
 *                 maxLength: 120
 *                 description: Optional. Defaults to "Untitled canvas"/"Untitled document".
 *     responses:
 *       201:
 *         description: Note created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 note:
 *                   type: object
 *       400:
 *         description: Body failed validation (missing/invalid noteType or title too long).
 *       401:
 *         description: No valid session cookie.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const parsed = await parseJsonBody(request, createNoteSchema);
  if (parsed instanceof NextResponse) return parsed;

  const now = new Date();
  const doc: NoteDoc = {
    title: parsed.title ?? defaultTitle(parsed.noteType),
    noteType: parsed.noteType,
    ownerId: user.firebaseUid,
    collaborators: [],
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  };

  const notes = await notesCollection();
  const { insertedId } = await notes.insertOne(doc);

  return NextResponse.json(
    { note: toNoteSummary({ ...doc, _id: insertedId }) },
    { status: 201 },
  );
}
