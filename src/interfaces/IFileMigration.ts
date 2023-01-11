interface IFileMigration {
  filename: string
  createdAt: Date
  existsInDatabase: boolean
}

export default IFileMigration
