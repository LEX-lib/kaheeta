import { describe, it, expect } from "vitest";
import { deriveKey, encryptBody, decryptBody } from "@/lib/wallecx/notesCrypto";

// Factory: build a deterministic 16-byte salt and derive a key from a fixed
// userId. Same (userId, saltSeed) inputs always yield an equivalent key, so
// ciphertext produced under one call decrypts under another.
async function makeKey(userId = "user000000abc12", saltSeed = 1): Promise<CryptoKey> {
  const salt = new Uint8Array(16).fill(saltSeed);
  return deriveKey(userId, salt);
}

const SAMPLE_BODY = '{"type":"doc","content":[{"type":"paragraph"}]}';

describe("encryptBody / decryptBody round-trip (ENC-01/ENC-03)", () => {
  it("decrypts back to the original plaintext body", async () => {
    const key = await makeKey();
    const ciphertext = await encryptBody(key, SAMPLE_BODY);
    const plaintext = await decryptBody(key, ciphertext);
    expect(plaintext).toEqual(SAMPLE_BODY);
  });

  it("ciphertext is not the plaintext JSON (server sees opaque bytes)", async () => {
    const key = await makeKey();
    const ciphertext = await encryptBody(key, SAMPLE_BODY);
    expect(ciphertext).not.toContain('"type"');
    expect(ciphertext).not.toContain("doc");
    expect(ciphertext).not.toEqual(SAMPLE_BODY);
  });
});

describe("fresh per-call IV (D-07)", () => {
  it("two encrypt calls on the same input produce different ciphertext", async () => {
    const key = await makeKey();
    const first = await encryptBody(key, SAMPLE_BODY);
    const second = await encryptBody(key, SAMPLE_BODY);
    expect(first).not.toEqual(second);
  });

  it("both differing ciphertexts decrypt back to the original", async () => {
    const key = await makeKey();
    const first = await encryptBody(key, SAMPLE_BODY);
    const second = await encryptBody(key, SAMPLE_BODY);
    expect(await decryptBody(key, first)).toEqual(SAMPLE_BODY);
    expect(await decryptBody(key, second)).toEqual(SAMPLE_BODY);
  });
});

describe("wrong key rejects (ENC-01 security)", () => {
  it("decrypting with a key from a different userId rejects", async () => {
    const writerKey = await makeKey("user000000abc12", 1);
    const attackerKey = await makeKey("user999999xyz99", 1);
    const ciphertext = await encryptBody(writerKey, SAMPLE_BODY);
    await expect(decryptBody(attackerKey, ciphertext)).rejects.toThrow();
  });
});

describe("legacy plaintext fallback contract (D-10)", () => {
  it("decrypting a raw Phase 1 plaintext body rejects (never returns garbage)", async () => {
    const key = await makeKey();
    // A legacy note stored its body as raw JSON, not Base64 ciphertext.
    await expect(decryptBody(key, '{"type":"doc"}')).rejects.toThrow();
  });
});

describe("large body round-trip (D-08 loop-based Base64)", () => {
  it("a body larger than 65KB round-trips without a RangeError", async () => {
    const key = await makeKey();
    const bigBody = JSON.stringify({ type: "doc", text: "a".repeat(70000) });
    const ciphertext = await encryptBody(key, bigBody);
    const plaintext = await decryptBody(key, ciphertext);
    expect(plaintext).toEqual(bigBody);
  });
});

describe("key stability (ENC-02)", () => {
  it("re-deriving from the same userId + salt yields an interchangeable key", async () => {
    const keyA = await makeKey("user000000abc12", 7);
    const keyB = await makeKey("user000000abc12", 7);
    // Ciphertext encrypted under keyA must decrypt under keyB and vice versa.
    const cipherFromA = await encryptBody(keyA, SAMPLE_BODY);
    const cipherFromB = await encryptBody(keyB, SAMPLE_BODY);
    expect(await decryptBody(keyB, cipherFromA)).toEqual(SAMPLE_BODY);
    expect(await decryptBody(keyA, cipherFromB)).toEqual(SAMPLE_BODY);
  });
});
