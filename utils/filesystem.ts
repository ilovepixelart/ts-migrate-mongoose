import fs from 'fs'
import path from 'path'

export const clearDirectory = (directory: string) => {
  const files = fs.readdirSync(directory)
  for (const file of files) {
    const filePath = path.join(directory, file)
    if (fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath)
    }
  }
}
