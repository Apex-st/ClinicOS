/** AES-256-GCM + PBKDF2-SHA-256. Ключ данных (DEK) не пишется на диск в открытом виде. */

export const KDF_ITERATIONS = 100_000;
export const DEK_BYTES = 32;
export const IV_BYTES = 12;
export const SALT_BYTES = 16;
export const RECOVERY_BYTES = 16;
export const PHOTO_MAGIC = "DNTA1";

const text = new TextEncoder();
const textOut = new TextDecoder();

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2) throw new Error("hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function formatRecoveryKey(bytes: Uint8Array): string {
  return bytesToHex(bytes).toUpperCase().match(/.{1,4}/g)!.join("-");
}

export function parseRecoveryKey(input: string): Uint8Array | null {
  const clean = input.replace(/[^0-9a-f]/gi, "");
  if (clean.length !== RECOVERY_BYTES * 2) return null;
  try {
    return hexToBytes(clean);
  } catch {
    return null;
  }
}

export function recoverySecret(input: string): string {
  return input.replace(/[^0-9a-f]/gi, "").toLowerCase();
}

export function cryptoAvailable() {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle);
}

async function importDek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptBytes(
  dek: Uint8Array,
  plain: Uint8Array,
): Promise<{ iv: Uint8Array; ct: Uint8Array }> {
  const iv = randomBytes(IV_BYTES);
  const key = await importDek(dek);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plain as BufferSource),
  );
  return { iv, ct };
}

export async function decryptBytes(dek: Uint8Array, iv: Uint8Array, ct: Uint8Array): Promise<Uint8Array> {
  const key = await importDek(dek);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource),
  );
}

export async function encryptJson(dek: Uint8Array, value: unknown): Promise<{ iv: string; ct: string }> {
  const { iv, ct } = await encryptBytes(dek, text.encode(JSON.stringify(value)));
  return { iv: bytesToBase64(iv), ct: bytesToBase64(ct) };
}

export async function decryptJson<T>(dek: Uint8Array, iv: string, ct: string): Promise<T> {
  const plain = await decryptBytes(dek, base64ToBytes(iv), base64ToBytes(ct));
  return JSON.parse(textOut.decode(plain)) as T;
}

export type KeyWrap = {
  kdf: "pbkdf2";
  iter: number;
  salt: string;
  iv: string;
  ct: string;
};

async function deriveWrapKey(secret: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", text.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function wrapDek(dek: Uint8Array, secret: string, iter = KDF_ITERATIONS): Promise<KeyWrap> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveWrapKey(secret, salt, iter);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, dek as BufferSource),
  );
  return {
    kdf: "pbkdf2",
    iter,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ct),
  };
}

export async function unwrapDek(wrap: KeyWrap, secret: string): Promise<Uint8Array | null> {
  if (!wrap?.ct || !wrap.salt || !wrap.iv) return null;
  try {
    const salt = base64ToBytes(wrap.salt);
    const iv = base64ToBytes(wrap.iv);
    const ct = base64ToBytes(wrap.ct);
    const key = await deriveWrapKey(secret, salt, wrap.iter || KDF_ITERATIONS);
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource),
    );
  } catch {
    return null;
  }
}

export function packPhoto(iv: Uint8Array, ct: Uint8Array): Uint8Array {
  const magic = text.encode(PHOTO_MAGIC);
  const out = new Uint8Array(magic.length + iv.length + ct.length);
  out.set(magic, 0);
  out.set(iv, magic.length);
  out.set(ct, magic.length + iv.length);
  return out;
}

export function unpackPhoto(buf: Uint8Array): { iv: Uint8Array; ct: Uint8Array } | null {
  const magic = text.encode(PHOTO_MAGIC);
  if (buf.length < magic.length + IV_BYTES + 16) return null;
  for (let i = 0; i < magic.length; i++) if (buf[i] !== magic[i]) return null;
  return {
    iv: buf.subarray(magic.length, magic.length + IV_BYTES),
    ct: buf.subarray(magic.length + IV_BYTES),
  };
}

export function isPhotoPacked(buf: Uint8Array): boolean {
  return unpackPhoto(buf) != null;
}
