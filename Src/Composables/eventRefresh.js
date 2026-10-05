export function createEventRefresh(refresh, delayMs = 500) {
  let timer
  let pending = false
  let running = false
  let generation = 0

  function schedule() {
    if (!pending || running || timer !== undefined) return
    const current = generation
    timer = setTimeout(() => {
      timer = undefined
      if (current !== generation || !pending) return
      pending = false
      running = true
      void Promise.resolve().then(() => {
        if (current === generation) return refresh()
      }).catch(() => {}).finally(() => {
        if (current !== generation) return
        running = false
        schedule()
      })
    }, delayMs)
  }

  function request() {
    pending = true
    schedule()
  }

  function clear() {
    generation += 1
    clearTimeout(timer)
    timer = undefined
    pending = false
    running = false
  }

  return { request, clear }
}
