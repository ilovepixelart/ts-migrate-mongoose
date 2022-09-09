interface IMigration {
  name: string
  filename: string
  state: 'up' | 'down'
  createdAt: Date
}

export default IMigration
