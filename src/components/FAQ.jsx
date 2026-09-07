import { Plus } from 'lucide-react'
import { useState } from 'react'
import SectionReveal from './SectionReveal'

const faqs = [
  ['What ages are Furfoo treats suitable for?', 'Most treats are designed for pets over three months old. Choose an appropriate texture and portion for your pet’s size, age and chewing habits.'],
  ['How should I store the treats?', 'Keep them sealed in a cool, dry place away from direct sunlight. Once opened, use the resealable pack and enjoy within the period printed on the label.'],
  ['Do you use natural ingredients?', 'Yes. Our treat recipes focus on recognisable meat, fish, vegetables and functional ingredients, with no artificial flavouring in the current range.'],
  ['Can sensitive pets use Furfoo products?', 'Every pet is different. Check the ingredient list, introduce new products gradually and consult your vet if your pet has a known allergy or medical condition.'],
  ['How do I use the herbal bath pack?', 'Steep the herbal sachet in warm water, let it cool to a comfortable temperature and use as a gentle final rinse. Full instructions will be included on each product page.'],
  ['Where do you deliver and how long will it take?', 'The starter store is prepared for Malaysia-wide shipping. Final delivery regions, rates and timelines can be connected to your fulfilment provider later.'],
]

export default function FAQ() {
  const [open, setOpen] = useState(0)
  return <section className="faq section" id="faq"><div className="section-shell faq-grid"><div className="faq-intro"><span className="eyebrow">GOOD TO KNOW</span><SectionReveal>Questions?<br/><em>Hachi knows.</em></SectionReveal><SectionReveal as="p">Still curious? Send the team a message and we’ll help you find the right pick.</SectionReveal><a href="https://wa.me/60199123946">Ask on WhatsApp →</a></div><div className="accordion">{faqs.map(([q,a], i) => <article className={open === i ? 'is-open' : ''} key={q}><button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}><span><i>0{i + 1}</i>{q}</span><Plus/></button><div className="answer"><p>{a}</p></div></article>)}</div></div></section>
}
