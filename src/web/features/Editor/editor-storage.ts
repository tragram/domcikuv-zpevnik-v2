import type { EditorState } from "~/types/types";

const EDITOR_STATE_PREFIX = "editor/state";

export const getEditorStateKey = (songId?: string, versionId?: string) =>
  songId
    ? `${EDITOR_STATE_PREFIX}/${songId}/${versionId ?? "unversioned"}`
    : EDITOR_STATE_PREFIX;

export const getEditorBackupKey = (stateKey: string) => `${stateKey}-backup`;

/**
 * Old editor drafts were shared by every version of a song. Only migrate one
 * when its recorded parent proves that it belongs to the version being opened.
 */
export const parseMatchingLegacyDraft = (
  raw: string | null,
  versionId?: string,
): EditorState | null => {
  if (!raw || !versionId) return null;

  try {
    const value = JSON.parse(raw) as unknown;
    if (
      value &&
      typeof value === "object" &&
      "parentId" in value &&
      (value as { parentId?: unknown }).parentId === versionId
    ) {
      return value as EditorState;
    }
  } catch {
    // Ignore malformed legacy data; the editor will use the fetched version.
  }

  return null;
};

export const readMatchingLegacyDraft = (
  songId?: string,
  versionId?: string,
  backup = false,
): EditorState | null => {
  if (typeof localStorage === "undefined" || !songId || !versionId) return null;
  const legacyStateKey = `${EDITOR_STATE_PREFIX}/${songId}`;
  const key = backup ? getEditorBackupKey(legacyStateKey) : legacyStateKey;
  return parseMatchingLegacyDraft(localStorage.getItem(key), versionId);
};
