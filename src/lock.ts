import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { LOCK_POLL_INTERVAL_MS } from './constants'

import type { Connection } from 'mongoose'

interface LockDocument {
  _id: string
  holder: string
  acquiredAt: Date
  expiresAt: Date
}

/**
 * A held lock. `lost` turns true when a renewal finds the document no longer
 * belongs to this holder, which only happens after the lease expired.
 */
export interface Lease {
  readonly lost: boolean
  release(): Promise<void>
}

const isDuplicateKeyError = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === 11000

/**
 * Mutual exclusion across processes through one document per key in a lock
 * collection. Expiry is checked against the acquiring client's clock, so the
 * hosts' clocks must agree to well within the lease.
 */
export class MigrationLock {
  private readonly connection: Connection
  private readonly collectionName: string
  private readonly key: string
  private readonly timeout: number
  private readonly leaseMs: number
  private indexReady: Promise<void> | undefined

  constructor(connection: Connection, collectionName: string, key: string, timeout: number, leaseMs: number) {
    this.connection = connection
    this.collectionName = collectionName
    this.key = key
    this.timeout = timeout
    this.leaseMs = leaseMs
  }

  /**
   * Takes the lock, polling while another holder has an unexpired lease, and
   * keeps renewing the lease until it is released.
   */
  async acquire(): Promise<Lease> {
    await this.ensureIndex()
    const holder = `${os.hostname()}:${process.pid}:${randomUUID()}`
    await this.waitFor(holder, Date.now() + this.timeout)
    return this.startLease(holder)
  }

  private async waitFor(holder: string, deadline: number): Promise<void> {
    if (await this.tryAcquire(holder)) return
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw await this.timeoutError()
    await sleep(Math.min(LOCK_POLL_INTERVAL_MS, remaining))
    return this.waitFor(holder, deadline)
  }

  private collection() {
    return this.connection.collection(this.collectionName)
  }

  private ensureIndex(): Promise<void> {
    // The TTL index only clears documents left by crashed holders; acquisition
    // checks expiry itself, so a role that cannot create indexes still works.
    this.indexReady ??= this.collection()
      .createIndexes([{ key: { expiresAt: 1 }, expireAfterSeconds: 0 }])
      .then(
        () => undefined,
        () => undefined,
      )
    return this.indexReady
  }

  /**
   * Inserts the lock document, or takes it over once its lease expired. A
   * live document makes the upsert collide on _id, which means "held".
   */
  private async tryAcquire(holder: string): Promise<boolean> {
    const now = new Date()
    try {
      await this.collection().updateOne({ _id: this.key, expiresAt: { $lte: now } } as object, { $set: { holder, acquiredAt: now, expiresAt: new Date(now.getTime() + this.leaseMs) } }, { upsert: true })
      return true
    } catch (error) {
      if (isDuplicateKeyError(error)) return false
      throw new Error(`Could not take the migration lock in collection '${this.collectionName}'. To run without it, set lock: false (CLI --lock false, env MIGRATE_LOCK=false).`, { cause: error })
    }
  }

  private startLease(holder: string): Lease {
    const collection = this.collection()
    const filter = { _id: this.key, holder } as object
    let lost = false
    const renew = async (): Promise<void> => {
      const result = await collection.updateOne(filter, { $set: { expiresAt: new Date(Date.now() + this.leaseMs) } })
      if (result.matchedCount === 0) lost = true
    }
    // A failed renewal is retried on the next tick; if the lease runs out
    // meanwhile, the next successful one reports it as lost.
    const timer = setInterval(() => {
      renew().catch(() => undefined)
    }, this.leaseMs / 3)
    timer.unref()

    return {
      get lost() {
        return lost
      },
      release: async () => {
        clearInterval(timer)
        // A document that cannot be removed expires with its lease; failing
        // here would hide the outcome of the work the lock guarded.
        await collection.deleteOne(filter).catch(() => undefined)
      },
    }
  }

  private async timeoutError(): Promise<Error> {
    const current = (await this.collection().findOne({ _id: this.key } as object)) as LockDocument | null
    const held = current ? ` held by '${current.holder}' since ${current.acquiredAt.toISOString()} (lease expires ${current.expiresAt.toISOString()} unless renewed)` : ''
    const remove = `db.getCollection(${JSON.stringify(this.collectionName)}).deleteOne({ _id: ${JSON.stringify(this.key)} })`
    return new Error(`Timed out after ${this.timeout} ms waiting for the migration lock${held}. If no other process is running migrations, wait for the lease to expire or remove the lock with ${remove}. To run without the lock, set lock: false (CLI --lock false, env MIGRATE_LOCK=false).`)
  }
}
