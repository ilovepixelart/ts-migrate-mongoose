let loaded = false

export const loader = async (): Promise<void> => {
  if (loaded) return

  await import('tsx')
    .then(() => {
      console.log('Loaded tsx')
      loaded = true
    })
    .catch(() => {
      console.log('Skipped tsx')
      loaded = false
    })
}