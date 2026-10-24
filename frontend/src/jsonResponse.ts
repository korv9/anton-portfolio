/**
 * A JSON path answered with something else, such as an HTML page from a host fallback, is a load
 * failure. It must not reach a page as "no data", so it throws a "could not be loaded" error.
 */
export async function assertJsonResponse(path: string, response: Response) {
  if (!/\.json$/.test(path.split('?')[0])) return
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('json')) return
  const page =
    type.includes('html') ||
    (await response.clone().text()).trimStart().startsWith('<')
  if (page)
    throw new Error(
      `${path} could not be loaded: the server answered with a page, not JSON`,
    )
}
