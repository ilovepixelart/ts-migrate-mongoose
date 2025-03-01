/**
 * Template used to create a new migration file
 */
export const template = `// Import your schemas here
import type { Connection } from 'mongoose'

export async function up (connection: Connection): Promise<void> {
  // Write migration here
}

export async function down (connection: Connection): Promise<void> {
  // Write migration here
}
`
