/**
 * Unsigned GitHub API reads for the platform page. GitHub allows 60 an hour per address, so
 * each answer is kept in session storage for five minutes, as WorkflowRuns.tsx does.
 */
export async function github<T>(path: string): Promise<T> {
  const key = `gh:${path}`
  try {
    const kept = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (kept && Date.now() - kept.at < 5 * 60e3) return kept.body
  } catch {
    // No session storage: ask again.
  }
  const response = await fetch(`https://api.github.com/repos/${path}`)
  if (!response.ok) throw new Error(`GitHub: HTTP ${response.status}`)
  const body = await response.json()
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), body }))
  } catch {
    // Nothing to keep it in.
  }
  return body
}

/** A file's text from the contents API, which sends it base64-encoded. */
export async function githubText(repo: string, path: string) {
  const { content } = await github<{ content: string }>(
    `${repo}/contents/${path}`,
  )
  const bytes = Uint8Array.from(atob(content.replace(/\s/g, '')), (c) =>
    c.charCodeAt(0),
  )
  return new TextDecoder().decode(bytes)
}
