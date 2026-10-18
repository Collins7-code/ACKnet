// The browser side of secure messaging: keeps your unlocked key on this
// device, and turns messages into scrambled envelopes and back.
import { supabase } from "./supabaseClient";
import { createIdentity, unlockIdentity, encryptMessage, decryptMessage } from "./e2ee";
import { api } from "../components/assess/api";

let session = null; // { userId, privateKey, publicKey, fingerprint }
export const getSession = () => session;

/* --- the key lives in this browser (IndexedDB), as a key the browser itself won't reveal --- */
const DB_NAME = "acknet-secure-chat";
const STORE = "keys";
const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
async function idb(mode, fn) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined; // private browsing etc.: fall back to asking for the passphrase each visit
  }
}

export async function loadServerKey() {
  const out = await api("/api/chat/keys");
  return out.key;
}

// What state is this person in? none (never set up) | locked (new device) | ready
export async function restoreSession(userId) {
  const serverKey = await loadServerKey();
  if (!serverKey) return { state: "none" };
  const saved = await idb("readonly", (s) => s.get(userId));
  if (saved && saved.publicKey === serverKey.public_key) {
    session = { userId, privateKey: saved.privateKey, publicKey: saved.publicKey, fingerprint: serverKey.fingerprint };
    return { state: "ready", session };
  }
  return { state: "locked", serverKey };
}

async function remember(userId) {
  await idb("readwrite", (s) => s.put({ privateKey: session.privateKey, publicKey: session.publicKey }, userId));
}

export async function setupNew(userId, passphrase, reset = false) {
  const id = await createIdentity({ userId, passphrase });
  await api("/api/chat/keys", { method: "POST", body: { public_key: id.publicKey, ...id.bundle, reset } });
  session = { userId, privateKey: id.privateKey, publicKey: id.publicKey, fingerprint: id.fingerprint };
  await remember(userId);
  keyCache.clear();
  return session;
}

export async function unlock(userId, serverKey, passphrase) {
  const privateKey = await unlockIdentity({ userId, publicKey: serverKey.public_key, bundle: serverKey, passphrase });
  session = { userId, privateKey, publicKey: serverKey.public_key, fingerprint: serverKey.fingerprint };
  await remember(userId);
  return session;
}

export async function lockThisDevice(userId) {
  session = null;
  await idb("readwrite", (s) => s.delete(userId));
}

/* --- other people's public keys --- */
const keyCache = new Map(); // id -> { publicKey, fingerprint, at }
export async function getPublicKeys(ids, { fresh = false } = {}) {
  const out = new Map();
  const need = [];
  for (const id of ids) {
    const hit = keyCache.get(id);
    if (!fresh && hit && Date.now() - hit.at < 30000) out.set(id, hit);
    else need.push(id);
  }
  if (need.length) {
    const { data } = await supabase.from("chat_keys").select("user_id, public_key, fingerprint").in("user_id", need);
    for (const k of data || []) {
      const v = { publicKey: k.public_key, fingerprint: k.fingerprint, at: Date.now() };
      keyCache.set(k.user_id, v);
      out.set(k.user_id, v);
    }
  }
  return out;
}

/* --- scramble / unscramble --- */
export async function sealMessage(conversationId, memberIds, payload) {
  if (!session) throw new Error("Secure messaging is locked. Please unlock it first.");
  const keys = await getPublicKeys(memberIds, { fresh: true });
  const recipients = [];
  for (const id of memberIds) {
    const k = keys.get(id);
    if (!k) throw new Error("Someone in this chat hasn't set up secure messaging yet.");
    recipients.push({ id, publicKey: k.publicKey });
  }
  return encryptMessage({
    payload,
    conversationId,
    senderId: session.userId,
    senderPrivateKey: session.privateKey,
    senderPublicKey: session.publicKey,
    recipients,
  });
}

export async function openMessage(envelope, conversationId) {
  if (!session) throw new Error("locked");
  return decryptMessage({ envelope, conversationId, recipientId: session.userId, recipientPrivateKey: session.privateKey });
}

export function previewOf(payload) {
  if (!payload) return "";
  if (payload.t === "text") return payload.body.length > 70 ? payload.body.slice(0, 70) + "…" : payload.body;
  if (payload.t === "file") return `📎 ${payload.name || "File"}`;
  return "Message";
}
