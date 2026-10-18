// End-to-end encryption for ACKnet messages.
//
// Runs in the browser (and Node 20+ for testing) using the built-in WebCrypto
// API: no outside code. The server only ever stores things it cannot read:
//   * each person's PUBLIC key
//   * their PRIVATE key, locked with their own passphrase (the server never
//     sees the passphrase)
//   * messages, which are scrambled so only the people in the chat can unscramble them
//
// How a message is protected:
//   1. A random one-time key (CEK) scrambles the message (AES-256-GCM).
//   2. For EVERY person in the chat (including the sender, so they can read
//      their own history) the CEK is locked with a key that only that pair of
//      people can work out: ECDH(sender's private key, recipient's public key)
//      -> HKDF -> AES-256-GCM.
//   3. Because the lock depends on the sender's private key, nobody (not even
//      the server) can forge a message "from" someone else.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();
const CURVE = { name: "ECDH", namedCurve: "P-256" };

export const PBKDF2_ITERATIONS = 600000;
export const MIN_ITERATIONS = 200000;
export const MIN_PASSPHRASE_LENGTH = 10;

export class E2EEError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/* ------------------------------- base64 ---------------------------------- */

export function b64encode(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}

export function b64decode(str) {
  const s = atob(str);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/* ------------------------- your identity (keys) -------------------------- */

async function passphraseKey(passphrase, salt, iterations) {
  const base = await subtle.importKey("raw", enc.encode(String(passphrase).normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// A short code two people can compare in person to be sure nobody is
// sitting in the middle.
export async function fingerprintOf(publicKeyB64) {
  const hash = new Uint8Array(await subtle.digest("SHA-256", b64decode(publicKeyB64)));
  const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 40).toUpperCase().match(/.{4}/g).join(" ");
}

// Make a brand-new identity. Returns what to send to the server (public key +
// the passphrase-locked private key) and a usable private key for this session.
export async function createIdentity({ userId, passphrase, iterations = PBKDF2_ITERATIONS, minIterations = MIN_ITERATIONS }) {
  if (!passphrase || String(passphrase).length < MIN_PASSPHRASE_LENGTH) {
    throw new E2EEError("short_passphrase", `Use at least ${MIN_PASSPHRASE_LENGTH} characters. Four random words works well.`);
  }
  if (iterations < minIterations) throw new E2EEError("weak_kdf", "Key protection is too weak.");

  const pair = await subtle.generateKey(CURVE, true, ["deriveBits"]);
  const publicKey = b64encode(await subtle.exportKey("raw", pair.publicKey));
  const pkcs8 = await subtle.exportKey("pkcs8", pair.privateKey);

  const salt = rand(16);
  const iv = rand(12);
  const wrapKey = await passphraseKey(passphrase, salt, iterations);
  const wrapped = await subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(`acknet-key-v1|${userId}|${publicKey}`) },
    wrapKey,
    pkcs8
  );
  // For everyday use the private key is re-imported as NON-extractable:
  // the browser itself will refuse to reveal it.
  const privateKey = await subtle.importKey("pkcs8", pkcs8, CURVE, false, ["deriveBits"]);

  return {
    publicKey,
    fingerprint: await fingerprintOf(publicKey),
    bundle: { wrapped_private_key: b64encode(wrapped), salt: b64encode(salt), iv: b64encode(iv), iterations },
    privateKey,
  };
}

// Unlock your private key on this device with your passphrase.
export async function unlockIdentity({ userId, publicKey, bundle, passphrase, minIterations = MIN_ITERATIONS }) {
  if (!bundle || bundle.iterations < minIterations) {
    throw new E2EEError("weak_kdf", "Your saved key looks damaged or tampered with.");
  }
  try {
    const wrapKey = await passphraseKey(passphrase, b64decode(bundle.salt), bundle.iterations);
    const pkcs8 = await subtle.decrypt(
      { name: "AES-GCM", iv: b64decode(bundle.iv), additionalData: enc.encode(`acknet-key-v1|${userId}|${publicKey}`) },
      wrapKey,
      b64decode(bundle.wrapped_private_key)
    );
    return await subtle.importKey("pkcs8", pkcs8, CURVE, false, ["deriveBits"]);
  } catch {
    throw new E2EEError("wrong_passphrase", "That passphrase isn't right.");
  }
}

/* ------------------------------- messages -------------------------------- */

// The lock that only this pair of people can open.
async function pairKey(myPrivateKey, theirPublicKeyB64, salt, info) {
  const theirPublic = await subtle.importKey("raw", b64decode(theirPublicKeyB64), CURVE, false, []);
  const bits = await subtle.deriveBits({ name: "ECDH", public: theirPublic }, myPrivateKey, 256);
  const hkdf = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode(info) },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// recipients: [{ id, publicKey }]  (must include the sender)
export async function encryptMessage({ payload, conversationId, senderId, senderPrivateKey, senderPublicKey, recipients }) {
  if (!recipients?.length) throw new E2EEError("no_recipients", "Nobody to send this to.");
  const cekRaw = rand(32);
  const cek = await subtle.importKey("raw", cekRaw, "AES-GCM", false, ["encrypt"]);
  const salt = rand(16);
  const iv = rand(12);

  const ct = await subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(`acknet-msg-v1|${conversationId}|${senderId}`) },
    cek,
    enc.encode(JSON.stringify(payload))
  );

  const keys = {};
  for (const r of recipients) {
    const lock = await pairKey(senderPrivateKey, r.publicKey, salt, `acknet-wrap-v1|${senderId}|${r.id}`);
    const wrapIv = rand(12);
    const wk = await subtle.encrypt(
      { name: "AES-GCM", iv: wrapIv, additionalData: enc.encode(`acknet-wrap-v1|${conversationId}|${senderId}|${r.id}`) },
      lock,
      cekRaw
    );
    keys[r.id] = { iv: b64encode(wrapIv), wk: b64encode(wk) };
  }

  return { v: 1, sid: senderId, spk: senderPublicKey, salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(ct), keys };
}

export async function decryptMessage({ envelope, conversationId, recipientId, recipientPrivateKey }) {
  try {
    if (!envelope || envelope.v !== 1) throw new Error("unsupported");
    const mine = envelope.keys?.[recipientId];
    if (!mine) throw new Error("not for you");
    const lock = await pairKey(recipientPrivateKey, envelope.spk, b64decode(envelope.salt), `acknet-wrap-v1|${envelope.sid}|${recipientId}`);
    const cekRaw = await subtle.decrypt(
      { name: "AES-GCM", iv: b64decode(mine.iv), additionalData: enc.encode(`acknet-wrap-v1|${conversationId}|${envelope.sid}|${recipientId}`) },
      lock,
      b64decode(mine.wk)
    );
    const cek = await subtle.importKey("raw", cekRaw, "AES-GCM", false, ["decrypt"]);
    const plain = await subtle.decrypt(
      { name: "AES-GCM", iv: b64decode(envelope.iv), additionalData: enc.encode(`acknet-msg-v1|${conversationId}|${envelope.sid}`) },
      cek,
      b64decode(envelope.ct)
    );
    return JSON.parse(dec.decode(plain));
  } catch {
    throw new E2EEError("cannot_decrypt", "This message can't be unlocked on this device.");
  }
}

/* ---------------------------- photos and files --------------------------- */

// Each file gets its own random key. The scrambled file is uploaded; the key
// travels INSIDE the encrypted message, so only people in the chat have it.
export async function encryptBytes(bytes) {
  const key = rand(32);
  const iv = rand(12);
  const k = await subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, k, bytes));
  return { cipher, key: b64encode(key), iv: b64encode(iv) };
}

export async function decryptBytes(cipher, keyB64, ivB64) {
  try {
    const k = await subtle.importKey("raw", b64decode(keyB64), "AES-GCM", false, ["decrypt"]);
    return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: b64decode(ivB64) }, k, cipher));
  } catch {
    throw new E2EEError("cannot_decrypt", "This file can't be unlocked.");
  }
}
