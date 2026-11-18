// Types for model.mjs.
import type fc from 'fast-check'

interface ModelMigrator {
  connection: { db?: unknown }
  close(): Promise<void>
}

type Connect = (options: { migrationsPath: string; collection: string }) => Promise<ModelMigrator>

export declare const checkAgainstModel: (check: typeof fc, connect: Connect, options?: { numRuns?: number; seed?: number }) => Promise<number>
export declare const singleRerun: (connect: Connect) => Promise<{ model: number[]; ran: string[]; executed: string[] }>
