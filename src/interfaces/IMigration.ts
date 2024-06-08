interface IMigration {
  name: string
  filename: string
  state: 'down' | 'up'
  createdAt: Date
  updatedAt: Date
}

export default IMigration
