import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientResponseError } from "pocketbase";

// ─── Mocks ───────────────────────────────────────────────────────────────────
// vi.hoisted: these fns are referenced inside vi.mock factories, which are
// hoisted above the (also-hoisted) ESM imports. Declaring them via vi.hoisted
// makes them initialized before any factory or mocked import runs (avoids TDZ).
const { getFirstListItem, create, update, deriveKey } = vi.hoisted(() => ({
  getFirstListItem: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deriveKey: vi.fn(),
}));

vi.mock("@/lib/pocketbase", () => ({
  pb: {
    collection: () => ({ getFirstListItem, create, update }),
    // The module registers a logout handler at import; capture is not needed here.
    authStore: { onChange: () => {} },
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { id: "user000000abc12" } }),
}));

// Mock the expensive PBKDF2 derivation — this suite tests the salt/key LIFECYCLE
// (race + caching + retry), not the cipher itself (covered by notesCrypto.test.ts).
vi.mock("@/lib/wallecx/notesCrypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wallecx/notesCrypto")>();
  return { ...actual, deriveKey };
});

import { useNotesCrypto } from "./useNotesCrypto";

const notFound = () => new ClientResponseError({ status: 404 });
const uniqueViolation = () => new ClientResponseError({ status: 400 });
// 16 zero-bytes as valid Base64 — a persisted salt.
const SALT_B64 = btoa("\0".repeat(16));

function saltRecord() {
  return { id: "settings1", user: "user000000abc12", note_encryption_salt: SALT_B64 };
}

describe("useNotesCrypto lifecycle (WR-01)", () => {
  beforeEach(() => {
    getFirstListItem.mockReset();
    create.mockReset();
    update.mockReset();
    deriveKey.mockReset();
    // A fresh key object per derivation lets us assert "derived exactly once".
    deriveKey.mockResolvedValue({ mock: "key" } as unknown as CryptoKey);
    // Reset the module-scoped key cache between tests.
    useNotesCrypto().clearKey();
  });

  it("concurrent first-calls share ONE derivation — no duplicate salt create (WR-01)", async () => {
    // First write: no settings record yet → 404, then create succeeds.
    getFirstListItem.mockRejectedValue(notFound());
    create.mockResolvedValue(saltRecord());

    const { getOrDeriveKey } = useNotesCrypto();
    // Fire three concurrent calls before any resolves.
    const [k1, k2, k3] = await Promise.all([
      getOrDeriveKey(),
      getOrDeriveKey(),
      getOrDeriveKey(),
    ]);

    // Exactly one salt bootstrap + one create + one derivation — the promise was
    // shared, not re-run per call (the bug would create() three times and race
    // the Unique constraint).
    expect(create).toHaveBeenCalledTimes(1);
    expect(getFirstListItem).toHaveBeenCalledTimes(1);
    expect(deriveKey).toHaveBeenCalledTimes(1);
    // All callers get the same key instance.
    expect(k1).toBe(k2);
    expect(k2).toBe(k3);
  });

  it("cross-context create race: create rejects 400, re-fetch converges on the winner's salt (WR-01)", async () => {
    // Our fetch sees no record (404); by the time we create(), another writer
    // already inserted it → Unique violation (400); re-fetch returns the winner.
    getFirstListItem.mockRejectedValueOnce(notFound()).mockResolvedValueOnce(saltRecord());
    create.mockRejectedValue(uniqueViolation());

    const { getOrDeriveKey } = useNotesCrypto();
    const key = await getOrDeriveKey();

    expect(key).toEqual({ mock: "key" });
    // Derived from the winner's persisted salt, not thrown away.
    expect(getFirstListItem).toHaveBeenCalledTimes(2);
    expect(deriveKey).toHaveBeenCalledTimes(1);
  });

  it("a failed derivation is not pinned — a later call retries (WR-01)", async () => {
    // First attempt: a real (non-404) backend error must reject AND clear the cache.
    getFirstListItem.mockRejectedValueOnce(new ClientResponseError({ status: 500 }));
    const { getOrDeriveKey } = useNotesCrypto();
    await expect(getOrDeriveKey()).rejects.toThrow();

    // Second attempt: backend recovers, record exists → succeeds (promise was not pinned).
    getFirstListItem.mockResolvedValueOnce(saltRecord());
    const key = await getOrDeriveKey();
    expect(key).toEqual({ mock: "key" });
    expect(deriveKey).toHaveBeenCalledTimes(1);
  });
});
