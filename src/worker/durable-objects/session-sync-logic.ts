/** Pure decision logic extracted out of SessionSync so it's testable without a
 *  Durable Object / WebSocket runtime. Nothing here touches ctx.storage,
 *  WebSocket instances, or D1 — callers resolve the live state (liveness,
 *  socket metadata) and pass it in. */

/** Order-insensitive equality for two id lists (used to skip no-op updates). */
export function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** A socket is alive if it was seen within staleAfterMs — "seen" being its
 *  last heartbeat ping, or (before the first ping) its connect time, so a
 *  socket that dies before ever pinging (e.g. a reload before the first
 *  heartbeat) still ages out instead of counting forever. */
export function isSocketAlive(
  lastSeenMs: number,
  nowMs: number,
  staleAfterMs: number,
): boolean {
  return nowMs - lastSeenMs < staleAfterMs;
}

/** serializeAttachment caps a socket's attachment at 2 KiB, and the subtree is
 *  client-supplied — bound both the id count and each id's length so a large
 *  (or hostile) subtree can't fail the attachment write or inflate the
 *  audience without limit. Audiences beyond the cap are undercounted. */
export const MAX_SUBTREE_IDS = 40;
export const MAX_CLIENT_ID_LENGTH = 64;

/** Validate a relay-subtree payload (untrusted client input) into a bounded
 *  list of client ids. */
export function sanitizeSubtree(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids: string[] = [];
  for (const id of input) {
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      id.length > MAX_CLIENT_ID_LENGTH
    )
      continue;
    ids.push(id);
    if (ids.length >= MAX_SUBTREE_IDS) break;
  }
  return ids;
}

export interface AudienceSocketInfo {
  isMaster: boolean;
  /** Announced departure (see "leave" message) — excluded regardless of liveness. */
  left?: boolean;
  alive: boolean;
  clientId: string;
  /** For relaying followers: the distinct client ids watching through them. */
  subtree?: string[];
}

/** The distinct client ids following a session. Each alive, non-departed
 *  follower contributes its own clientId plus every id in the subtree it
 *  reported (relay-subtree). Because it's a set, a client reachable both
 *  directly and through a relay — e.g. during a relay reconfiguration — is
 *  counted once. Master sockets and ghosts are excluded. */
export function computeAudience(sockets: AudienceSocketInfo[]): Set<string> {
  const clients = new Set<string>();
  for (const meta of sockets) {
    if (meta.isMaster) continue;
    if (meta.left) continue;
    if (!meta.alive) continue;
    clients.add(meta.clientId);
    if (meta.subtree) for (const id of meta.subtree) clients.add(id);
  }
  return clients;
}

export interface ChainUpdateInput {
  /** Chain path reported by the sender; if present it already includes the
   *  sender as its last element. */
  incomingChainPath?: string[];
  masterId: string | null;
  masterNickname: string | null;
  incomingOriginatorNickname?: string | null;
  /** True when this update is being relayed from an upstream session, rather
   *  than chosen first-party by this session's own master. */
  isRelay?: boolean;
  isFirstSong: boolean;
  wasRelaying: boolean;
  currentSongId: string | null;
  currentVersionId: string | null;
  songId: string;
  /** Normalized to null when the update carries no version, matching how
   *  currentVersionId is stored — an undefined here would make the
   *  "version changed?" comparison always true for version-less songs. */
  versionId: string | null;
}

export interface ChainUpdateResult {
  chainPath: string[];
  originatorNickname: string | null;
  /** Whether this update should be persisted to D1's session-history table.
   *  Only first-party updates are written, so relayed content never pollutes
   *  the "who's listening to what" list; `wasRelaying` forces a write when a
   *  master returns to first-party broadcasting, even with an unchanged
   *  songId, so it reappears in the sessions list after hiding while relaying. */
  shouldWriteToDb: boolean;
}

export function resolveChainUpdate(input: ChainUpdateInput): ChainUpdateResult {
  const chainPath =
    input.incomingChainPath && input.incomingChainPath.length > 0
      ? input.incomingChainPath
      : input.masterId
        ? [input.masterId]
        : [];

  const originatorNickname =
    chainPath.length > 1
      ? (input.incomingOriginatorNickname ?? null)
      : input.masterNickname;

  const shouldWriteToDb =
    !input.isRelay &&
    !!input.masterId &&
    !!input.songId &&
    (input.isFirstSong ||
      input.wasRelaying ||
      input.songId !== input.currentSongId ||
      input.versionId !== input.currentVersionId);

  return { chainPath, originatorNickname, shouldWriteToDb };
}
