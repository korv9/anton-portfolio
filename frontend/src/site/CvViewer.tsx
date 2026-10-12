import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { profile } from '../content'
import { l } from '../i18n'
import './cv-viewer.css'

const CvContext = createContext<((trigger: HTMLElement) => void) | null>(null)

export function CvButton() {
  const open = useContext(CvContext)
  return (
    <button
      type="button"
      className="cv-trigger"
      aria-haspopup="dialog"
      aria-label={l('View CV', 'Visa CV')}
      onClick={(event) => open?.(event.currentTarget)}
    >
      CV
    </button>
  )
}

export function CvViewerProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open || !dialog.current) return
    const scroll = scrollY
    const bodyStyle = document.body.style
    const previous = {
      position: bodyStyle.position,
      top: bodyStyle.top,
      width: bodyStyle.width,
      overflow: bodyStyle.overflow,
    }
    const htmlOverflow = document.documentElement.style.overflow
    Object.assign(bodyStyle, {
      position: 'fixed',
      top: `${-scroll}px`,
      width: '100%',
      overflow: 'hidden',
    })
    document.documentElement.style.overflow = 'hidden'
    dialog.current.showModal()
    closeButton.current?.focus()
    return () => {
      clearTimeout(closeTimer.current)
      Object.assign(bodyStyle, previous)
      document.documentElement.style.overflow = htmlOverflow
      window.scrollTo({ top: scroll, behavior: 'instant' })
      trigger.current?.focus({ preventScroll: true })
    }
  }, [open])

  const close = () => {
    if (closing) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.current?.close()
    } else {
      setClosing(true)
      closeTimer.current = setTimeout(() => dialog.current?.close(), 160)
    }
  }

  return (
    <CvContext.Provider
      value={(element) => {
        trigger.current = element
        setClosing(false)
        setOpen(true)
      }}
    >
      {children}
      <dialog
        ref={dialog}
        className="cv-viewer"
        aria-labelledby="cv-viewer-title"
        data-closing={closing}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button, iframe',
          )
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClose={() => setOpen(false)}
      >
        {open && profile.cv && (
          <div className="cv-viewer-layout">
            <div className="cv-viewer-toolbar">
              <h2 id="cv-viewer-title">Anton Ernstsson · CV</h2>
              <a className="cv-download" href={profile.cv} download>
                {l('Download CV', 'Ladda ned CV')}
              </a>
              <button
                ref={closeButton}
                type="button"
                className="cv-close"
                onClick={close}
                aria-label={l('Close CV', 'Stäng CV')}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <p className="cv-viewer-help">
              {l(
                'If the preview is unavailable, ',
                'Om förhandsvisningen inte fungerar, ',
              )}
              <a href={profile.cv} target="_blank" rel="noreferrer">
                {l('open the PDF in a new tab', 'öppna PDF-filen i en ny flik')}
              </a>
              .
            </p>
            {navigator.pdfViewerEnabled ? (
              <iframe
                className="cv-document"
                src={profile.cv}
                title={l(
                  'Anton Ernstsson CV document',
                  'Anton Ernstssons CV-dokument',
                )}
              />
            ) : (
              <div className="cv-viewer-fallback">
                <p>
                  {l(
                    'This browser cannot display the PDF here. Open it in a new tab or choose Download CV above.',
                    'Den här webbläsaren kan inte visa PDF-filen här. Öppna den i en ny flik eller välj Ladda ned CV ovan.',
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </dialog>
    </CvContext.Provider>
  )
}
