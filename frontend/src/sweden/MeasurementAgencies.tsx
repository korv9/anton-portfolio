/**
 * A — the "measured elsewhere" check: items SCB's and Kolada's catalogues credit to each agency
 * the page names as holding a thin domain (summary.json `elsewhere`).
 */
import { l } from '../i18n'
import { name, num, type Domain, type Elsewhere } from './MeasurementExplore'

export default function Agencies({
  elsewhere,
  domains,
}: {
  elsewhere: Elsewhere
  domains: Domain[]
}) {
  return (
    <>
      <h3>
        {l(
          'Agencies credited in the two catalogues',
          'Myndigheter som anges som källa i de två katalogerna',
        )}
      </h3>
      <div className="sw-table-wrap">
        <table className="sw-table">
          <caption className="visually-hidden">
            {l(
              'Items each catalogue credits to an agency named on this page',
              'Poster som katalogerna anger med en myndighet som nämns på sidan som källa',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Agency', 'Myndighet')}</th>
              <th scope="col">{l('Holds', 'Ansvarar för')}</th>
              <th scope="col" className="sw-n">
                {l('Items credited', 'Poster')}
              </th>
              <th scope="col" className="sw-n">
                {l('Municipal or finer', 'Kommun eller finare')}
              </th>
            </tr>
          </thead>
          <tbody>
            {elsewhere.map((a) => {
              const held = domains.find((d) => d.id === a.holds)
              return (
                <tr key={a.agency}>
                  <th scope="row">{a.agency}</th>
                  <td>{held ? name(held) : a.holds}</td>
                  <td className="sw-n">{num(a.items)}</td>
                  <td className="sw-n">{num(a.municipal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="sw-note">
        {l(
          'A zero means the agency is not named as a source in SCB’s or Kolada’s catalogue. Its own statistics are not fetched yet, so a zero is not evidence that the domain is unmeasured.',
          'En nolla betyder att myndigheten inte anges som källa i SCB:s eller Koladas katalog. Dess egen statistik hämtas inte ännu, så en nolla visar inte att domänen är omätt.',
        )}
      </p>
    </>
  )
}
