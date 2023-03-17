import fs from 'fs'
import path from 'path'

const folder = process.argv.slice(2)[0]

const deleteFolderRecursive = (dir: string) => {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const cur = path.join(dir, file)
      if (fs.lstatSync(cur).isDirectory()) {
        deleteFolderRecursive(cur)
      } else {
        fs.unlinkSync(cur)
      }
    })
    fs.rmSync(dir, { recursive: true })
  }
}

if (folder) {
  deleteFolderRecursive(path.join(__dirname, '../dist', folder))
} else {
  deleteFolderRecursive(path.join(__dirname, '../dist/cjs'))
  deleteFolderRecursive(path.join(__dirname, '../dist/esm'))
  deleteFolderRecursive(path.join(__dirname, '../dist/types'))
}
