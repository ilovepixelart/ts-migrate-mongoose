import { describe, expect, it } from 'vitest'

import mongoose from 'mongoose'
import { getMigrationModel } from '../src/model'

describe('getMigrationModel', () => {
  it('rejects an empty collection name with a TypeError', () => {
    const connection = mongoose.createConnection()
    expect(() => getMigrationModel(connection, '')).toThrow(TypeError)
    expect(() => getMigrationModel(connection, '')).toThrow(/^Collection name cannot be empty$/)
    expect(connection.modelNames()).toEqual([])
  })
})
