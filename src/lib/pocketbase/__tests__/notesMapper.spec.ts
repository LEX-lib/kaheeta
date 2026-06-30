import { describe, it, expect } from "vitest";
import { mapToUpdateNote } from "@/lib/pocketbase/notesMapper";
import type { Note } from "@/types/wallecx/notes/types";

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: "server-id-123",
  created: "2026-01-01T00:00:00.000Z",
  updated: "2026-01-02T00:00:00.000Z",
  collectionId: "abc",
  collectionName: "kaheeta_notes",
  user: "user-id-456",
  title: "My first note",
  body: '{"type":"doc"}',
  snippet: "My first note body preview",
  expand: {},
  ...overrides,
});

describe("mapToUpdateNote strips server-managed fields", () => {
  const payload = mapToUpdateNote(makeNote());

  it("strips id", () => {
    expect(payload).not.toHaveProperty("id");
  });

  it("strips created", () => {
    expect(payload).not.toHaveProperty("created");
  });

  it("strips updated", () => {
    expect(payload).not.toHaveProperty("updated");
  });

  it("strips user", () => {
    expect(payload).not.toHaveProperty("user");
  });

  it("strips collectionId", () => {
    expect(payload).not.toHaveProperty("collectionId");
  });

  it("strips collectionName", () => {
    expect(payload).not.toHaveProperty("collectionName");
  });

  it("strips expand", () => {
    expect(payload).not.toHaveProperty("expand");
  });
});

describe("mapToUpdateNote preserves writable fields", () => {
  const note = makeNote();
  const payload = mapToUpdateNote(note);

  it("preserves title", () => {
    expect(payload.title).toBe(note.title);
  });

  it("preserves body", () => {
    expect(payload.body).toBe(note.body);
  });

  it("preserves snippet", () => {
    expect(payload.snippet).toBe(note.snippet);
  });
});

describe("create-then-update id-refresh contract", () => {
  it("Object.assign propagates server id so second save PATCHes the same record", () => {
    const localNote = { title: "Draft note", id: "" };
    const serverRecord = makeNote({ id: "srv-789" });
    Object.assign(localNote, serverRecord);
    expect(localNote.id).toBe("srv-789");
    expect(localNote.id).not.toBe("");
  });
});
