import fs from 'node:fs'
import path from 'node:path'

export const clearDirectory = (dir: string) => {
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filePath = path.join(dir, file)
    if (fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath)
    }
  }
}
