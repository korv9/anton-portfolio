import { l } from './i18n'

export type Topic = [string, string, string]
export default function TopicNav({
  items,
  active,
  label = l('Choose a view', 'Välj vy'),
}: {
  items: Topic[]
  active: string
  label?: string
}) {
  return (
    <nav className="topic-tabs" aria-label={label}>
      {items.map(([href, en, sv]) => (
        <a
          key={href}
          href={href}
          aria-current={active === href ? 'page' : undefined}
        >
          {l(en, sv)}
        </a>
      ))}
    </nav>
  )
}
