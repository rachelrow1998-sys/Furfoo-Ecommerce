import ScrollReveal from './ScrollReveal'

const sectionRevealAnimation = {
  baseOpacity: 0.28,
  enableBlur: false,
  baseRotation: 1.5,
  blurStrength: 3,
  rotationEnd: 'center center',
  wordAnimationEnd: 'center center',
}

export default function SectionReveal({ children, as = 'h2', className = '' }) {
  return (
    <ScrollReveal
      {...sectionRevealAnimation}
      as={as}
      containerClassName={`section-scroll-reveal ${className}`.trim()}
    >
      {children}
    </ScrollReveal>
  )
}
