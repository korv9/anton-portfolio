import { currentLocale, setLocale } from '../i18n'

/** Switches the page between English and Swedish; the button names the language it switches to. */
export default function LanguageToggle() {
  const next = currentLocale() === 'sv' ? 'en' : 'sv'
  return (
    <button
      type="button"
      // cv-trigger: the site's link-styled button, 44 px high, shared with the CV button.
      className="cv-trigger language-toggle"
      lang={next}
      onClick={() => setLocale(next)}
    >
      {next === 'sv' ? 'Svenska' : 'English'}
    </button>
  )
}
