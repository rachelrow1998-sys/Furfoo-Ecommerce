import AnimatedTestimonials from './ui/AnimatedTestimonials'
import SectionReveal from './SectionReveal'
import ReviewsAdoptionTransition from './ReviewsAdoptionTransition'

const reviews = [
  { pet: 'Milo', owner: '@miloandmay', product: 'Salmon & Chicken Strips', text: 'He heard the packet from two rooms away. The clean ingredients make me just as happy as he is.', image: '/media/brand/hachi-real.jpg' },
  { pet: 'Coco', owner: 'Sarah L.', product: 'Greens Biscuits', text: 'Finally a crunchy treat that agrees with Coco’s sensitive tummy. It is now part of our morning ritual.', image: '/media/products/greens-biscuits.jpg' },
  { pet: 'Bao Bao', owner: 'Jia Wen', product: 'Duck & Salmon Roll', text: 'The rolls keep her busy and the double texture is a huge win. No crumbs all over the sofa either.', image: '/media/products/duck-salmon-roll.jpg' },
  { pet: 'Poppy', owner: 'Amelia T.', product: 'Wholesome Chips', text: 'Poppy is usually very picky, but these disappeared in seconds. I love that I can recognise every ingredient.', image: '/media/products/wholesome-chips.jpg' },
  { pet: 'Hachi', owner: '@hachiathome', product: 'All-in-One Bites', text: 'The perfect little reward for training days. They are easy to portion, smell fresh, and always get his full attention.', image: '/media/brand/hachi-action.png' },
  { pet: 'Ollie', owner: 'Daniel K.', product: 'Salmon & Chicken Strips', text: 'One packet has become our walk-time essential. Ollie comes running as soon as he sees the Furfoo bag.', image: '/media/products/salmon-chicken.jpg' },
]

export default function Reviews() {
  return (
    <section className="reviews section" id="reviews">
      <div className="section-shell">
        <header className="section-head">
          <div><span className="eyebrow">THE FURFOO FAMILY</span><SectionReveal>Happy pets,<br />happy humans.</SectionReveal></div>
          <SectionReveal as="p">Real notes from the pets who did the tasting — and the people who opened the packet.</SectionReveal>
        </header>
        <AnimatedTestimonials testimonials={reviews} autoplay interval={4200} />
      </div>
      <ReviewsAdoptionTransition />
    </section>
  )
}
