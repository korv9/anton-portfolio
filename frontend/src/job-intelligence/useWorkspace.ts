import { useEffect, useMemo, useState } from 'react'
import { fetchData } from '../dataSource'
import { useCompanyData } from '../companies/CompanyIntelligence'
import {
  jobInstant,
  latestJobs,
  parseWorkspace,
  type WorkspaceContent,
} from './model'
import { parseProfile, type SearchProfile } from './profile'
import { rankCandidates } from './ranking'

export default function useWorkspace(requestedId: string | null) {
  const { data, state, retry } = useCompanyData()
  const [profile, setProfile] = useState<SearchProfile | null>(null)
  const [profileState, setProfileState] = useState(
    import.meta.env.DEV &&
      ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
      ? 'checking'
      : 'public',
  )
  const [primary, setPrimary] = useState<WorkspaceContent | null>(null),
    [remaining, setRemaining] = useState<WorkspaceContent | null>(null)
  const [detailState, setDetailState] = useState(
    'Loading the full advertisement…',
  )
  const [attempt, setAttempt] = useState(0),
    [clock, setClock] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (
      !import.meta.env.DEV ||
      !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    )
      return
    const controller = new AbortController()
    fetch('/__local/job-intelligence-profile', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        if (r.status === 404) return null
        if (!r.ok) throw new Error('Local profile unavailable')
        const value = await r.json()
        return value.state === 'local' ? parseProfile(value.profile) : null
      })
      .then((p) => {
        if (!controller.signal.aborted) {
          setProfile(p)
          setProfileState(p ? 'local' : 'public')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setProfileState('invalid')
      })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    setPrimary(null)
    setRemaining(null)
    if (!data) return
    const controller = new AbortController()
    setDetailState('Loading the full advertisement…')
    fetchData('jobs/workspace.json', { signal: controller.signal })
      .then((r) => r.json())
      .then((v) => {
        const parsed = parseWorkspace(v, data)
        if (!controller.signal.aborted) setPrimary(parsed)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDetailState(
            'The full advertisement package could not be loaded or verified. The original source remains available.',
          )
      })
    return () => controller.abort()
  }, [data, attempt])
  const needsRemaining = !!(
    data &&
    primary &&
    (profile ||
      (requestedId && !primary.jobs.some((j) => j.job_id === requestedId)))
  )
  useEffect(() => {
    if (!data || !needsRemaining || remaining) return
    const controller = new AbortController()
    setDetailState('Loading extended advertisement evidence…')
    fetchData('jobs/workspace-remaining.json', { signal: controller.signal })
      .then((r) => r.json())
      .then((v) => {
        const parsed = parseWorkspace(v, data, { remaining: true })
        if (!controller.signal.aborted) setRemaining(parsed)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDetailState(
            'The extended advertisement package could not be loaded or verified. Open the original source or retry.',
          )
      })
    return () => controller.abort()
  }, [data, needsRemaining, remaining, attempt])
  const details = useMemo(
    () => [...(primary?.jobs || []), ...(remaining?.jobs || [])],
    [primary, remaining],
  )
  const active = useMemo(
    () =>
      data?.jobs.filter(
        (j) =>
          !j.application_deadline ||
          jobInstant(j.application_deadline, true) >= clock,
      ) || [],
    [data, clock],
  )
  const rankings = useMemo(
    () =>
      profile && primary && remaining
        ? rankCandidates(active, details, profile)
        : [],
    [active, details, profile, primary, remaining],
  )
  const recommended = rankings.filter((r) => r.suitable).slice(0, 50)
  const jobs =
    profileState === 'checking'
      ? []
      : profile
        ? recommended.map((r) => active.find((j) => j.job_id === r.job_id)!)
        : data
          ? latestJobs(data, clock)
          : []
  return {
    data,
    state,
    retry,
    profile,
    profileState,
    details,
    detailState,
    rankings,
    jobs,
    ready:
      profileState !== 'checking' && !!primary && (!profile || !!remaining),
    candidateCount: active.length,
    suitableCount: rankings.filter((r) => r.suitable).length,
    retryDetails: () => setAttempt((n) => n + 1),
  }
}
