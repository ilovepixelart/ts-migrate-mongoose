import fs from 'node:fs/promises'
import path from 'node:path'

export const clearDirectory = async (dir: string) => {
  try {
    await fs.access(dir) // Check if directory exists
  } catch {
    return // Exit if not
  }

  const files = await fs.readdir(dir)

  const promises = files.map(async (file) => {
    const filePath = path.join(dir, file)

    try {
      const stats = await fs.stat(filePath)
      if (stats.isFile()) {
        await fs.unlink(filePath)
      }
    } catch (err) {
      console.warn(`Skipping file: ${filePath} - ${err.message}`)
    }
  })

  await Promise.all(promises)
}

export const deleteDirectory = async (dir: string) => {
  try {
    await fs.rmdir(dir, { recursive: true })
  } catch (err) {
    console.warn(`Failed to delete directory: ${dir} - ${err.message}`)
  }
}
