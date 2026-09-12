// A view owns its asynchronous UI work. Leaving it invalidates the lease.
export function createViewLifecycle() {
  let current = null
  const reads = new Map()
  return {
    get current() { return current },
    begin(kind) {
      current?.controller.abort()
      reads.clear()
      const controller = new AbortController()
      current = { kind, controller, signal: controller.signal }
      return current
    },
    isCurrent(lease) { return Boolean(lease && current === lease && !lease.signal.aborted) },
    read(key) { const token = { view: current }; reads.set(key, token); return { key, token } },
    isReadCurrent(lease) { return this.isCurrent(lease?.token?.view) && reads.get(lease.key) === lease.token },
  }
}
