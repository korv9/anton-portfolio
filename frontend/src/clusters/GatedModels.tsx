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
          'Each was scored on data it never saw and had to clear a rule set before its first run.',
          'Varje modell prövades på data den aldrig sett och måste klara en regel som sattes före första körningen.',
        )}
      </p>
      <ModelCards passedOnly />
    </section>
  )
}
