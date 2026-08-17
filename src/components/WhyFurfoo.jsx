import { Apple, BadgeCheck, FlaskConical, HeartHandshake, Wheat } from 'lucide-react'

const points = [[Apple, 'Real Ingredients'], [HeartHandshake, 'Thoughtfully Made'], [FlaskConical, 'Pet-Friendly Formulas'], [Wheat, 'Small-Batch Quality'], [BadgeCheck, 'Hachi Approved']]

export default function WhyFurfoo() {
  return <section className="why section"><div className="why-track">{points.map(([Icon, label], i) => <div className={`why-badge badge-${i}`} key={label}><span><Icon/></span><strong>{label}</strong><small>0{i + 1}</small></div>)}</div></section>
}
