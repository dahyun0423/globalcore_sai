"use client";

/** 녹음 파일은 용량이 커서 localStorage 대신 IndexedDB에 둔다. 서버로는 보내지 않는다. */
const DB = "fieldkit-audio";
const STORE = "clips";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "key" });
      store.createIndex("interviewId", "interviewId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface Clip {
  key: string;
  interviewId: string;
  createdAt: string;
  blob: Blob;
}

export async function saveClip(interviewId: string, blob: Blob): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      key: `${interviewId}:${Date.now()}`,
      interviewId,
      createdAt: new Date().toISOString(),
      blob,
    } satisfies Clip);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listClips(interviewId: string): Promise<Clip[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE)
      .objectStore(STORE)
      .index("interviewId")
      .getAll(interviewId);
    req.onsuccess = () => resolve(req.result as Clip[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteClips(interviewId: string): Promise<void> {
  const clips = await listClips(interviewId);
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const c of clips) tx.objectStore(STORE).delete(c.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
