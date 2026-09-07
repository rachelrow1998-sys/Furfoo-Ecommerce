import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'

const cardRotations = [-7, 6, -4, 8, -6, 4]

export default function AnimatedTestimonials({ testimonials, autoplay = true, interval = 4500 }) {
  const [active, setActive] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isPaused, setIsPaused] = useState(false)
  const reduceMotion = useReducedMotion()

  const showNext = useCallback(() => {
    setDirection(1)
    setActive((current) => (current + 1) % testimonials.length)
  }, [testimonials.length])

  const showPrevious = () => {
    setDirection(-1)
    setActive((current) => (current - 1 + testimonials.length) % testimonials.length)
  }

  useEffect(() => {
    if (!autoplay || isPaused || testimonials.length < 2) return undefined
    const timer = window.setInterval(showNext, interval)
    return () => window.clearInterval(timer)
  }, [autoplay, interval, isPaused, showNext, testimonials.length])

  if (!testimonials.length) return null
  const testimonial = testimonials[active]

  return (
    <div
      className="animated-testimonials"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false)
      }}
      aria-roledescription="carousel"
      aria-label="Customer reviews"
    >
      <button className="direction-button direction-button--left testimonial-side-control is-previous" type="button" onClick={showPrevious} aria-label="Previous review"><ChevronLeft /></button>

      <div className="testimonial-visual" aria-hidden="true">
        {testimonials.map((item, index) => {
          const offset = (index - active + testimonials.length) % testimonials.length
          const visible = offset < 3

          return (
            <motion.div
              className="testimonial-photo-card"
              key={item.image}
              initial={false}
              animate={{
                opacity: visible ? 1 - offset * 0.24 : 0,
                scale: visible ? 1 - offset * 0.055 : 0.88,
                x: visible ? offset * 12 : 24,
                y: visible ? offset * 7 : 18,
                rotate: offset === 0 ? 0 : cardRotations[index % cardRotations.length],
                zIndex: testimonials.length - offset,
              }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <img src={item.image} alt="" draggable="false" />
              <span className="testimonial-photo-number">{String(index + 1).padStart(2, '0')}</span>
            </motion.div>
          )
        })}
      </div>

      <div className="testimonial-copy">
        <div className="testimonial-live" aria-live="polite">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.article
              key={testimonial.pet}
              custom={direction}
              initial={reduceMotion ? false : { opacity: 0, y: 18 * direction, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 * direction, filter: 'blur(5px)' }}
              transition={{ duration: reduceMotion ? 0 : 0.32, ease: 'easeOut' }}
            >
              <div className="testimonial-stars" aria-label="5 out of 5 stars">
                {[0, 1, 2, 3, 4].map((star) => <Star key={star} fill="currentColor" />)}
              </div>
              <blockquote>“{testimonial.text}”</blockquote>
              <footer>
                <strong>{testimonial.pet}</strong>
                <span>{testimonial.owner} · {testimonial.product}</span>
              </footer>
            </motion.article>
          </AnimatePresence>
        </div>

        <div className="testimonial-controls">
          <div className="testimonial-progress" aria-label={`Review ${active + 1} of ${testimonials.length}`}>
            {testimonials.map((item, index) => (
              <button
                type="button"
                key={item.pet}
                className={index === active ? 'is-active' : ''}
                onClick={() => {
                  setDirection(index > active ? 1 : -1)
                  setActive(index)
                }}
                aria-label={`Show review ${index + 1}`}
                aria-current={index === active ? 'true' : undefined}
              />
            ))}
          </div>
          <span className="testimonial-pause-state">{isPaused ? 'Paused' : 'Auto-playing'}</span>
        </div>
      </div>

      <button className="direction-button direction-button--right testimonial-side-control is-next" type="button" onClick={showNext} aria-label="Next review"><ChevronRight /></button>
    </div>
  )
}
