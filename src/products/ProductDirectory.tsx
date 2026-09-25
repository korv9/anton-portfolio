import { useEffect, useState } from 'react'
type Product = { id: string; title: string; status: string; question: string; description: string; skills: string[]; href: string; source: string | null; data: string | null }
export default function ProductDirectory() {
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState(false)
  useEffect(() => { fetch('/data/products/catalog.json').then((r) => { if (!r.ok) throw Error(); return r.json() }).then(setProducts).catch(() => setError(true)) }, [])
  return <section className="product-directory" id="product-directory"><header><p className="eyebrow">Projects / questions / evidence</p><h2>A collection of things I wanted to understand.</h2><p>My professional experience is in data and applied AI. These projects show how I organise data, test ideas and make the results accessible. Each has its own purpose and level of maturity.</p></header>
    {error && <p role="alert">The project directory could not be loaded.</p>}
    <div className="product-cards">{products.map((product, index) => <article key={product.id}><div className="product-status"><span>0{index + 1}</span>{product.status}</div><h3>{product.title}</h3><p className="product-question">{product.question}</p><p>{product.description}</p><div className="product-actions"><a href={product.href}>Open project →</a>{product.source && <a href={product.source} target="_blank" rel="noreferrer">Source code ↗</a>}{product.data && <a href={product.data}>{product.id === 'politics' ? 'Read speeches' : 'Data & methods'} ↓</a>}</div></article>)}</div>
  </section>
}
