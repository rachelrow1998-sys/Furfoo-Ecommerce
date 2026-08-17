import { useLayoutEffect, useRef, useState } from 'react'
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react'
import './ScrollVelocity.css'

function useElementWidth(ref) {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const updateWidth = () => setWidth(ref.current?.offsetWidth ?? 0)
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [ref])

  return width
}

function wrap(min, max, value) {
  const range = max - min
  return ((((value - min) % range) + range) % range) + min
}

function VelocityText({
  children,
  baseVelocity,
  scrollContainerRef,
  className,
  damping,
  stiffness,
  numCopies,
  velocityMapping,
  parallaxClassName,
  scrollerClassName,
  parallaxStyle,
  scrollerStyle,
}) {
  const baseX = useMotionValue(0)
  const scrollOptions = scrollContainerRef ? { container: scrollContainerRef } : {}
  const { scrollY } = useScroll(scrollOptions)
  const scrollVelocity = useVelocity(scrollY)
  const smoothVelocity = useSpring(scrollVelocity, { damping, stiffness })
  const velocityFactor = useTransform(
    smoothVelocity,
    velocityMapping.input,
    velocityMapping.output,
    { clamp: false },
  )
  const copyRef = useRef(null)
  const copyWidth = useElementWidth(copyRef)
  const x = useTransform(baseX, value => copyWidth ? `${wrap(-copyWidth, 0, value)}px` : '0px')

  useAnimationFrame((_, delta) => {
    let moveBy = baseVelocity * (delta / 1000)
    moveBy += moveBy * Math.abs(velocityFactor.get())
    baseX.set(baseX.get() + moveBy)
  })

  return <div className={parallaxClassName} style={parallaxStyle}>
    <motion.div className={scrollerClassName} style={{ x, ...scrollerStyle }}>
      {Array.from({ length: numCopies }, (_, index) => <span className={className} key={index} ref={index === 0 ? copyRef : null}>
        {children}&nbsp;
      </span>)}
    </motion.div>
  </div>
}

export default function ScrollVelocity({
  scrollContainerRef,
  texts = [],
  velocity = 100,
  className = '',
  damping = 50,
  stiffness = 400,
  numCopies = 6,
  velocityMapping = { input: [0, 1000], output: [0, 5] },
  parallaxClassName = 'parallax',
  scrollerClassName = 'scroller',
  parallaxStyle,
  scrollerStyle,
}) {
  return <section>
    {texts.map((text, index) => <VelocityText
      key={index}
      baseVelocity={index % 2 === 0 ? velocity : -velocity}
      scrollContainerRef={scrollContainerRef}
      className={className}
      damping={damping}
      stiffness={stiffness}
      numCopies={numCopies}
      velocityMapping={velocityMapping}
      parallaxClassName={parallaxClassName}
      scrollerClassName={scrollerClassName}
      parallaxStyle={parallaxStyle}
      scrollerStyle={scrollerStyle}
    >
      {text}
    </VelocityText>)}
  </section>
}
