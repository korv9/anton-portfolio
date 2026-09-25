import { t } from '../i18n'
import { useEffect, useState } from 'react'
type Product = { id: string; title: string; status: string; question: string; description: string; skills: string[]; href: string; source: string | null; data: string | null }
export default function ProductDirectory() {
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState(false)
  useEffect(() => { fetch('/data/products/catalog.json').then((r) => { if (!r.ok) throw Error(); return r.json() }).then(setProducts).catch(() => setError(true)) }, [])
  return <section className="product-directory" id="product-directory"><header><p className="eyebrow">{t("Projects / questions / evidence")}</p><h2>{t("A collection of things I wanted to understand.")}</h2><p>{t("My professional experience is in data and applied AI. These projects show how I organise data, test ideas and make the results accessible. Each has its own purpose and level of maturity.")}</p></header>
    {error && <p role="alert">{t("The project directory could not be loaded.")}</p>}
    <div className="product-cards">{products.map((product, index) => <article key={product.id}><div className="product-status"><span>0{index + 1}</span>{t(product.status)}</div><h3>{t(product.title)}</h3><p className="product-question">{t(product.question)}</p><p>{t(product.description)}</p><div className="product-actions"><a href={product.href}>{t("Open project →")}</a>{product.source && <a href={product.source} target="_blank" rel="noreferrer">{t("Source code ↗")}</a>}{product.data && <a href={product.data}>{t(product.id === 'politics' ? 'Read speeches' : 'Data & methods')} ↓</a>}</div></article>)}</div>
  </section>
}
