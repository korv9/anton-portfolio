/**
 * What does it even mean? An overwhelming feed of every chart the site's data allows. No prose:
 * only the title, the charts and their legends. The feed itself lives in ./Feed.tsx, which the
 * home page also mounts in its light theme.
 */
import Feed from './Feed'
import '../sweden/sweden.css'

export default function MeaningPage() {
  return (
    <main className="sweden mean-page">
      <h1 className="mean-title">What does it even mean?</h1>
      <Feed />
    </main>
  )
}
