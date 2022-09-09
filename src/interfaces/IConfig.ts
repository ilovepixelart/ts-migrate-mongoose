interface IConfiguration {
  connectionString?: string
  templatePath?: string
  migrationsPath?: string
  collection?: string
  autosync?: boolean
}

export default IConfiguration
