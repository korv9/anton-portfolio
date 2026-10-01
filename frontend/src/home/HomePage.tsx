/**
 * The start page as a portfolio, one scroll: who Anton is, the selected work, about, experience,
 * the tools, the smaller work and how to get in touch. An overview with one preview per project;
 * the analysis itself lives on each project's page, so nothing heavy loads here.
 */
import { l } from '../i18n'
import { ABOUT, type Bilingual } from './content'
import HeroFlow from './HeroFlow'
import {
  ContactSection,
  ExperienceTimeline,
  Hero,
  OtherWork,
  Section,
  SelectedWork,
  SkillGroups,
} from './sections'
import { useReveal } from './reveal'
import './home.css'
import './portfolio.css'

const b = (text: Bilingual) => l(text.en, text.sv)

export default function HomePage() {
  const root = useReveal<HTMLDivElement>([])
  return (
    <div className="cv home pf" ref={root}>
      <Hero />

      <Section
        id="work"
        title={l('Selected work', 'Utvalda projekt')}
        lead={l(
          'Three projects, each from raw data to something you can use. Open one for the full analysis, method and data.',
          'Tre projekt, vart och ett från rådata till något som går att använda. Öppna ett för hela analysen, metoden och datan.',
        )}
      >
        <SelectedWork />
      </Section>

      <Section id="om-mig" title={l('About me', 'Om mig')}>
        <HeroFlow>
          <div className="pf-about">
            {ABOUT.map((p) => (
              <p key={p.en}>{b(p)}</p>
            ))}
          </div>
        </HeroFlow>
      </Section>

      <Section id="erfarenhet" title={l('Experience', 'Erfarenhet')}>
        <ExperienceTimeline />
      </Section>

      <Section
        id="teknik"
        title={l('Tools and technologies', 'Verktyg och tekniker')}
      >
        <SkillGroups />
      </Section>

      <Section id="mer" title={l('Other work', 'Annat jag byggt')}>
        <OtherWork />
      </Section>

      <Section
        id="kontakt"
        title={l('Let’s connect', 'Hör av dig')}
        lead={l(
          'Interested in data engineering, analytics or AI-driven products? I am open to junior roles.',
          'Intresserad av data engineering, analys eller AI-drivna produkter? Jag är öppen för juniora roller.',
        )}
      >
        <ContactSection />
      </Section>
    </div>
  )
}
