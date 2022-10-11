interface IMigrationModule {
  up?: () => Promise<void>
  down?: () => Promise<void>
}

export default IMigrationModule
