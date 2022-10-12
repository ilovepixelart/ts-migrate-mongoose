interface IMigration {
  name: string
  filename: string
  state: 'down' | 'up'
  createdAt: Date
}

export default IMigration
