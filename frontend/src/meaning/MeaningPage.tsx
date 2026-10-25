/**
 * What does it even mean? An overwhelming feed of every chart the site's data allows. No prose:
 * only the title, one line per subject, the charts and their legends. The feed lives in ./Feed.tsx.
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
