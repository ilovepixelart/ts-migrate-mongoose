import { ArgumentsCamelCase } from 'yargs'

interface IArgs extends ArgumentsCamelCase {
  md: string
  t: string
  d: string
  collection: string
  autosync: boolean
  migrationName: string
}

export default IArgs
