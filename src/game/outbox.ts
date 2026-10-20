/**
 * Durable on-device outbox. Every write gets one id. A retry sends that same id,
 * so the server can ignore a duplicate. IndexedDB when the browser has it,
 * otherwise memory (tests and private mode).
 */

export type OutboxKind = 'score' | 'spend' | 'earn' | 'stripe' | 'friend_request' | 'friend_connect' | 'challenge' | 'result' | 'live' | 'inbox_read'

export interface OutboxOp {
  id: string
  kind: OutboxKind
  payload: Record<string, unknown>
  createdAt: number
  attempts: number
  nextAt: number
}

export interface OutboxStore {
  list(): Promise<OutboxOp[]>
  put(op: OutboxOp): Promise<void>
  delete(id: string): Promise<void>
}

const memory = new Map<string, OutboxOp>()

const memoryStore: OutboxStore = {
  async list() {
    return [...memory.values()]
  },
  async put(op) {
    if (!memory.has(op.id)) memory.set(op.id, op)
  },
  async delete(id) {
    memory.delete(id)
  },
}

const DB = 'rg-outbox'
const STORE = 'ops'

function idbStore(): OutboxStore | null {
  if (typeof indexedDB === 'undefined') return null
  return {
    list() {
      return withStore('readonly', (store) => requestToPromise(store.getAll()) as Promise<OutboxOp[]>)
    },
    put(op) {
      return withStore('readwrite', (store) => {
        return new Promise<void>((resolve, reject) => {
          const req = store.get(op.id)
          req.onsuccess = () => {
            if (req.result) {
              resolve()
              return
            }
            const add = store.add(op)
            add.onsuccess = () => resolve()
            add.onerror = () => reject(add.error)
          }
          req.onerror = () => reject(req.error)
        })
      })
    },
    delete(id) {
      return withStore('readwrite', (store) => requestToPromise(store.delete(id)).then(() => undefined))
    },
  }
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => {
      const db = open.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction(STORE, mode)
      const store = tx.objectStore(STORE)
      fn(store).then(resolve, reject)
    }
  })
}

let backing: OutboxStore | null = null

export function setOutboxStore(store: OutboxStore | null): void {
  backing = store
}

function store(): OutboxStore {
  if (backing) return backing
  return idbStore() ?? memoryStore
}

export function newOpId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Insert once. A second call with the same id does not create another row. */
export async function enqueueOp(kind: OutboxKind, payload: Record<string, unknown>, id = newOpId()): Promise<string> {
  const op: OutboxOp = { id, kind, payload, createdAt: Date.now(), attempts: 0, nextAt: Date.now() }
  await store().put(op)
  scheduleSync()
  return id
}

export async function listDue(now = Date.now()): Promise<OutboxOp[]> {
  const rows = await store().list()
  return rows.filter((row) => row.nextAt <= now).sort((a, b) => a.createdAt - b.createdAt)
}

export async function listPending(): Promise<OutboxOp[]> {
  const rows = await store().list()
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

/** Backoff: 2s, 4s, 8s, … capped at 5 minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, attempts - 1))
}

/** put() ignores an existing id, so a retry replaces the row. */
export async function replaceOp(op: OutboxOp): Promise<void> {
  await store().delete(op.id)
  await store().put(op)
}

export async function reschedule(op: OutboxOp, now = Date.now()): Promise<void> {
  const attempts = op.attempts + 1
  await replaceOp({ ...op, attempts, nextAt: now + backoffMs(attempts) })
}

export async function ackOp(id: string): Promise<void> {
  await store().delete(id)
}

export function scheduleSync(): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.ready) return
  void navigator.serviceWorker.ready
    .then((reg) => {
      const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync
      return sync?.register('rg-outbox')
    })
    .catch(() => undefined)
}

const listeners = new Set<(n: number) => void>()

export function onOutboxCount(fn: (n: number) => void): () => void {
  listeners.add(fn)
  void listPending().then((rows) => fn(rows.length))
  return () => listeners.delete(fn)
}

export async function emitOutboxCount(): Promise<void> {
  const n = (await listPending()).length
  for (const fn of listeners) fn(n)
}
