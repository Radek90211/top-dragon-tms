// Consume the body before returning, so a timeout covers headers and content.
export async function fetchWithDeadlineV155(url, options = {}) {
  const signal = options.signal || AbortSignal.timeout(30000)
  const response = await fetch(url, { ...options, signal })
  const body = await response.arrayBuffer()
  return new Response([204, 205, 304].includes(response.status) ? null : body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
