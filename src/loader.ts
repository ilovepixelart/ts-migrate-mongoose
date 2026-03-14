let loaded = false

export const loader = async (): Promise<void> => {
  if (loaded) return

  await import('tsx')
    .then(() => {
      loaded = true
    })
    .catch(() => {
      loaded = false
    })
}
