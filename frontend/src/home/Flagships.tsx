/**
 * The two flagships at the top of the page: the platform, with one live fact from the release
 * this page reads, and right under it a slot for the job assistant's live preview.
 */
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { currentLocale, l } from '../i18n'
import ClusterPreview from './ClusterPreview'
import { FeedBoundary } from './HomeFeed'
import { JOB_ASSISTANT, PLATFORM, type Bilingual } from './content'

const b = (text: Bilingual) => l(text.en, text.sv)
const REPO = 'https://github.com/korv9/anton-portfolio'

/** The release the page reads from, or nothing while it loads or when it cannot be read. */
function useRelease() {
  const [release, setRelease] = useState<{ at: string; groups: number }>()
  useEffect(() => {
    let live = true
    import('../dataSource')
      .then((d) => d.deliveryState())
      .then((s) => {
        if (live && s.activatedAt)
          setRelease({
            at: s.activatedAt,
            groups: Object.keys(s.groups ?? {}).length,
          })
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return release
}

function ReleaseProof() {
  const release = useRelease()
  const at = release && new Date(release.at)
  if (!release || !at || Number.isNaN(at.getTime())) return null
  const when = at.toLocaleString(currentLocale() === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return (
    <p className="home-proof">
      <span className="home-proof-dot" aria-hidden="true" />
      {l(
        `The release this page reads from was published ${when} and holds ${release.groups} dataset groups.`,
        `Releasen som sidan läser från publicerades ${when} och innehåller ${release.groups} grupper av datamängder.`,
      )}
    </p>
  )
}

export function PlatformFlagship() {
  return (
    <>
      <span className="home-project-marker" aria-hidden="true" />
      <div className="home-work-heading" id="platform">
        <h2 id="projects-title" className="home-work-title">
          {b(PLATFORM.title)}
        </h2>
        <div className="home-project-intro">
          {PLATFORM.text.map((text) => (
            <p key={text.en} className="home-flagship-text">
              {b(text)}
            </p>
          ))}
          <ReleaseProof />
          <p className="home-links home-flagship-links">
            <a
              href={`${REPO}/blob/main/docs/case-studies/platform.md`}
              target="_blank"
              rel="noreferrer"
            >
              {b(PLATFORM.caseStudy)}
            </a>
            <a href={REPO} target="_blank" rel="noreferrer">
              {b(PLATFORM.code)}
            </a>
          </p>
        </div>
        <JobAssistantSlot />
      </div>
      <ClusterPreview kind="jobs" background />
    </>
  )
}

/**
 * The job assistant's slot. Contract: the job assistant owns `src/jobs/JobAssistantPreview.tsx`;
 * its default export takes no props and renders inside this section (id="jobs"). Until that file
 * exists, or if it fails to load, the slot shows the static entry below.
 */
const preview = Object.values(
  import.meta.glob<{ default: ComponentType }>(
    '../jobs/JobAssistantPreview.tsx',
  ),
)[0]
const Preview = preview && lazy(preview)

function JobAssistantSlot() {
  const entry = (
    <div className="home-flagship-entry">
      <h2 className="work-title">{b(JOB_ASSISTANT.title)}</h2>
      <p className="work-question">{b(JOB_ASSISTANT.text)}</p>
    </div>
  )
  return (
    <section
      className="home-flagship-slot"
      id="jobs"
      aria-label={b(JOB_ASSISTANT.title)}
    >
      {Preview ? (
        <FeedBoundary fallback={entry}>
          <Suspense fallback={entry}>
            <Preview />
          </Suspense>
        </FeedBoundary>
      ) : (
        entry
      )}
    </section>
  )
}
