interface IFileError extends Error {
  code?: string
  path?: string
}

export default IFileError
