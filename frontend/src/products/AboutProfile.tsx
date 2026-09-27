import { t } from '../i18n'
export default function AboutProfile() {
  return (
    <section className="about-profile" aria-labelledby="about-story">
      <header>
        <p className="eyebrow">{t('A little more about me')}</p>
        <h2 id="about-story">
          {t('I like understanding how the pieces fit together.')}
        </h2>
        <p>
          {t(
            "I'm Anton, a junior Data Engineer / Analytics Engineer based in Stockholm. I enjoy bringing structure to complicated information: finding out where it comes from, making it reliable and turning it into something people can use.",
          )}
        </p>
        <p>
          {t(
            'My AI Developer studies at JENSEN led into data engineering and analytics internships at Fora and Avtalat. Working with both pipelines and reporting has made me interested in the whole journey, from a source system to the questions someone wants to answer.',
          )}
        </p>
      </header>
      <div className="about-columns">
        <section>
          <p className="eyebrow">{t('Experience / learning by building')}</p>
          <h3>{t('From source systems to useful reports.')}</h3>
          <ol className="experience-story">
            <li>
              <div>
                <strong>{t('Avtalat · Analytics Engineer')}</strong>
                <span>{t('Jan–Jun 2026 · LIA internship')}</span>
              </div>
              <p>
                {t(
                  'Extended Freshservice ETL in Azure Databricks using PySpark and Spark SQL. Built Power BI reports and semantic models with DirectQuery and DAX, and worked on reproducible incident analysis with attention to data quality and anonymisation.',
                )}
              </p>
            </li>
            <li>
              <div>
                <strong>{t('Fora · Data Engineer')}</strong>
                <span>{t('Nov 2025–Jan 2026 · LIA internship')}</span>
              </div>
              <p>
                {t(
                  'Built API ingestion and incremental Bronze, Silver and Gold pipelines. The work included validation, error handling and a Gold-layer star schema for IT service reporting.',
                )}
              </p>
            </li>
            <li>
              <div>
                <strong>{t('Delicato · Machine Operator')}</strong>
                <span>2022–2025</span>
              </div>
              <p>
                {t(
                  'Worked with production, quality control and technical troubleshooting. Also served as vice-chair of the local union club.',
                )}
              </p>
            </li>
          </ol>
        </section>
        <div className="about-notes">
          <section>
            <p className="eyebrow">{t('Education')}</p>
            <h3>{t('AI Developer · JENSEN')}</h3>
            <p>
              {t(
                '2024–2026 · Higher Vocational Education, 400 YH credits. Graduated June 2026.',
              )}
            </p>
            <p>
              {t(
                'My professional experience is in data and analytics. My frontend skills come from studies and personal projects, including making these reports accessible in the browser.',
              )}
            </p>
          </section>
          <section>
            <p className="eyebrow">{t('Outside the job description')}</p>
            <h3>{t("Projects start with something I'm curious about.")}</h3>
            <p>
              {t(
                'I built the political observatory because I find it difficult to connect what politicians say with budgets and formal decisions. I want people to be able to read the evidence themselves.',
              )}
            </p>
            <p>
              {t(
                'The other projects follow different questions: how the job market changes, how requirements change meaning, and whether a predictive model still works on unfamiliar data. This site is a place to explore those questions as well as see how I work.',
              )}
            </p>
          </section>
          <section>
            <p className="eyebrow">{t("What I'm looking for")}</p>
            <p>
              {t(
                'A junior role in data engineering or analytics engineering where I can contribute with Python, SQL and data modelling, keep learning, and work with the people who use the results.',
              )}
            </p>
            <p>{t('Stockholm · Swedish and English')}</p>
            <a href="mailto:anton.ernstson@gmail.com">{t("Let's talk ↗")}</a>
          </section>
        </div>
      </div>
      <section className="about-toolkit">
        <p className="eyebrow">
          {t('My toolkit / across work, studies and projects')}
        </p>
        <div className="toolkit-grid">
          <div>
            <h3>{t('Build & model')}</h3>
            <p>{t('Python · SQL · PySpark · Spark SQL')}</p>
            <span>
              {t(
                'Databricks · Delta Lake · dbt Core · DuckDB · ETL/ELT · dimensional modelling',
              )}
            </span>
          </div>
          <div>
            <h3>{t('Analyse & explain')}</h3>
            <p>{t('Power BI · DAX · pandas')}</p>
            <span>
              {t(
                'Semantic models · DirectQuery · KPI definitions · data validation',
              )}
            </span>
          </div>
          <div>
            <h3>{t('Explore & evaluate')}</h3>
            <p>{t('NLP · embeddings · clustering')}</p>
            <span>
              {t(
                'sentence-transformers · UMAP · HDBSCAN · MLflow · model evaluation',
              )}
            </span>
          </div>
          <div>
            <h3>{t('Test & share')}</h3>
            <p>{t('Git · pytest · CI/CD')}</p>
            <span>
              {t(
                'Azure DevOps · GitHub Actions · FastAPI · React · TypeScript',
              )}
            </span>
          </div>
        </div>
      </section>
    </section>
  )
}

export function StudyProjects() {
  return (
    <section className="study-projects" aria-labelledby="study-projects-title">
      <p className="eyebrow">{t('More from my studies & experiments')}</p>
      <h2 id="study-projects-title">{t("Other questions I've explored.")}</h2>
      <p>
        {t(
          'Earlier projects documented in my previous portfolio. These are short project summaries; interactive results and source datasets are not included here.',
        )}
      </p>
      <div className="toolkit-grid">
        <article>
          <h3>{t('RAG Learning Assistant')}</h3>
          <p>
            {t(
              'A course-material assistant exploring document ingestion, retrieval, chat and quiz generation.',
            )}
          </p>
          <span>{t('Python · RAG · Vertex AI · Flask · React')}</span>
        </article>
        <article>
          <h3>{t('Pump Diagnostics · MIMII')}</h3>
          <p>
            {t(
              'An audio-classification study using Mel spectrograms and a convolutional neural network to distinguish normal and anomalous pump sounds.',
            )}
          </p>
          <span>{t('Python · TensorFlow · librosa · model evaluation')}</span>
        </article>
        <article>
          <h3>{t('in1 · AI Playground')}</h3>
          <p>
            {t(
              'An experiment with multiple language models, modular API routing, authentication and prompt tracking.',
            )}
          </p>
          <span>{t('Python · Flask · React · LLM APIs · JWT')}</span>
        </article>
      </div>
      <a
        href="https://github.com/theazero/anton-portfolio"
        target="_blank"
        rel="noreferrer"
      >
        {t('Earlier portfolio & project descriptions ↗')}
      </a>
    </section>
  )
}
