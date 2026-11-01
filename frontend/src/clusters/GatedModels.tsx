/**
 * Supervised models whose gate passed (ml/models.json). A model held by its gate is not shown;
 * its card under ml/cards/ records why. Styled as the experiments section beside it.
 */
import { l } from '../i18n'
import { ModelCards } from '../tech/ModelCards'
import './experiments/experiments.css'

export default function GatedModels() {
  return (
    <section className="cx" id="cv-models" aria-labelledby="cv-models-title">
      <h2 id="cv-models-title">
        {l('Models that passed their gate', 'Modeller som klarat sin spärr')}
      </h2>
      <p className="cx-question">
        {l(
          "Each was scored on data it never saw and had to clear a rule recorded in the first run's result. A rule changed later is dated in docs/ml-gate-amendments.md. A model that leaves one session out still trains on later sessions, so its score is not a forecast.",
          'Varje modell prövades på data den aldrig sett och måste klara en regel som finns i första körningens resultat. En regel som ändrats senare är daterad i docs/ml-gate-amendments.md. En modell som lämnar ut ett riksmöte i taget tränas ändå på senare riksmöten, så resultatet är ingen prognos.',
        )}
      </p>
      <ModelCards passedOnly />
    </section>
  )
}
