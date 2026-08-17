import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import './FurfooScrollHero.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/*
 * Replace the opening artwork in /public/media/brand/ and the Hachi clips
 * in /public/videos/, or update their paths in HERO_CONFIG.
 * No animation code needs to be changed.
 */
export const HERO_CONFIG = {
  introLogo: '/media/brand/homee-toggle-logo.png',
  videos: [
    {
      id: 'hero-final',
      src: '/videos/hero-banner-final.mp4',
      poster: '/videos/hero-banner-poster.jpg',
      preload: 'auto',
    },
  ],
  background: '#f7f0e3',
  desktop: {
    scrollDistanceVh: 66,
    objectPosition: 'center center',
    introInitialScale: 0.32,
    shakeX: 3,
    shakeScale: 1.006,
  },
  mobile: {
    breakpoint: 820,
    scrollDistanceVh: 52,
    objectPosition: '43% center',
    introInitialScale: 0.58,
    shakeX: 2,
    shakeScale: 1.004,
  },
  intro: {
    logoRiseDuration: 1.28,
    logoHoldDuration: 0.24,
    logoFadeDuration: 0.28,
    cardExpandDuration: 0.82,
    hachiCrossfadeDuration: 0.38,
  },
  timeline: {
    impactStart: 64,
    end: 100,
  },
  scrollStages: [
    { videoIndex: 0, start: 0 },
  ],
  scrubSmoothing: 0.45,
  scrubVideoFrames: false,
  loadingTimeoutMs: 6500,
}

const isUsableDuration = (video) =>
  video.readyState >= HTMLMediaElement.HAVE_METADATA &&
  Number.isFinite(video.duration) &&
  video.duration > 0

export default function FurfooScrollHero() {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const introPanelRef = useRef(null)
  const introLogoLayerRef = useRef(null)
  const introStartRef = useRef(null)
  const videoRefs = useRef([])
  const introAssetStatusRef = useRef({ logo: false, videos: new Set() })
  const [introAssetReady, setIntroAssetReady] = useState(false)
  const [failedVideos, setFailedVideos] = useState(() => new Set())

  useEffect(() => {
    if (introAssetReady) return undefined
    const timeout = window.setTimeout(
      () => {
        setIntroAssetReady(true)
        introStartRef.current?.()
      },
      HERO_CONFIG.loadingTimeoutMs,
    )
    return () => window.clearTimeout(timeout)
  }, [introAssetReady])

  const refreshScrollTrigger = () => {
    window.requestAnimationFrame(() => ScrollTrigger.refresh())
  }

  const startIntroWhenReady = () => {
    const { logo, videos } = introAssetStatusRef.current
    if (!logo || videos.size < HERO_CONFIG.videos.length) return
    setIntroAssetReady(true)
    introStartRef.current?.()
  }

  const handleVideoReady = (index) => {
    introAssetStatusRef.current.videos.add(index)
    startIntroWhenReady()
    refreshScrollTrigger()
  }

  const handleIntroLogoReady = () => {
    introAssetStatusRef.current.logo = true
    startIntroWhenReady()
    refreshScrollTrigger()
  }

  const handleIntroLogoError = () => {
    setIntroAssetReady(true)
    introStartRef.current?.()
  }

  const handleVideoError = (index) => {
    setFailedVideos((current) => new Set(current).add(index))
  }

  useGSAP(
    () => {
      const root = rootRef.current
      const stage = stageRef.current
      const introPanel = introPanelRef.current
      const introLogoLayer = introLogoLayerRef.current
      const introLogo = introLogoLayer?.querySelector('img')
      const layers = gsap.utils.toArray('.furfoo-scroll-hero__video-layer', root)
      const videos = videoRefs.current.filter(Boolean)
      let activeIndex = -1
      let introComplete = false
      let introHasStarted = false
      let introTimeline
      let disposed = false
      const originalBodyOverflow = document.body.style.overflow

      const pauseInactiveVideos = (activeVideoIndex) => {
        videos.forEach((video, index) => {
          if (index !== activeVideoIndex) video.pause()
        })
      }

      const playVideo = (video) => {
        video.muted = true
        video.defaultMuted = true
        video.volume = 0
        const playPromise = video.play()
        if (playPromise?.catch) playPromise.catch(() => {})
      }

      const activateStage = (nextIndex, direction = 1, force = false) => {
        if (!force && nextIndex === activeIndex) return

        pauseInactiveVideos(nextIndex)
        const video = videos[nextIndex]
        if (!video) return

        if (HERO_CONFIG.scrubVideoFrames) {
          video.pause()
          activeIndex = nextIndex
          return
        }

        const movingForward = direction >= 0
        const atFinalFrame = isUsableDuration(video) &&
          video.currentTime >= video.duration - 0.12

        // Forward stage entries always start cleanly. Reverse entries resume an
        // unfinished video, and restart only if it is already on its final frame.
        if (movingForward || video.ended || atFinalFrame) {
          try { video.currentTime = 0 } catch { /* metadata is not ready yet */ }
        }

        activeIndex = nextIndex
        playVideo(video)
      }

      const stageAtProgress = (progress) => {
        let selectedStage = HERO_CONFIG.scrollStages[0]
        HERO_CONFIG.scrollStages.forEach((candidate) => {
          if (progress >= candidate.start) selectedStage = candidate
        })
        return selectedStage
      }

      const scrubActiveVideo = (progress) => {
        const selectedStage = stageAtProgress(progress)
        const stagePosition = HERO_CONFIG.scrollStages.indexOf(selectedStage)
        const nextStart = HERO_CONFIG.scrollStages[stagePosition + 1]?.start ?? 1
        const index = selectedStage.videoIndex
        if (index !== activeIndex) activateStage(index, 1)
        pauseInactiveVideos(index)

        const video = videos[index]
        if (!video || !isUsableDuration(video)) return
        const localProgress = gsap.utils.clamp(
          0,
          1,
          (progress - selectedStage.start) / (nextStart - selectedStage.start),
        )
        video.pause()
        video.currentTime = localProgress * video.duration
      }

      const matchMedia = gsap.matchMedia()

      matchMedia.add(
        {
          desktop: `(min-width: ${HERO_CONFIG.mobile.breakpoint + 1}px)`,
          mobile: `(max-width: ${HERO_CONFIG.mobile.breakpoint}px)`,
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { desktop, reduceMotion } = context.conditions

          if (reduceMotion) {
            introComplete = true
            root.classList.add('is-intro-complete')
            videos.forEach((video) => video.pause())
            gsap.set(introPanel, { opacity: 1, scale: 1, clearProps: 'borderRadius' })
            gsap.set(introLogoLayer, { opacity: 0 })
            gsap.set(layers, { opacity: 0 })
            gsap.set(layers[0], { opacity: 1 })
            introStartRef.current = () => {}
            return undefined
          }

          const responsive = desktop ? HERO_CONFIG.desktop : HERO_CONFIG.mobile
          const timelineConfig = HERO_CONFIG.timeline
          const holdClock = { progress: 0 }

          gsap.set(layers, { opacity: 0 })
          gsap.set(layers[0], { opacity: 1 })
          gsap.set(introLogoLayer, { opacity: 0, scale: 1 })
          gsap.set(introLogo, {
            x: 0,
            y: 0,
            opacity: 1,
            clipPath: 'inset(0 0% 0 0)',
          })
          gsap.set(introPanel, {
            x: 0,
            scale: 1,
            opacity: 1,
            clearProps: 'borderRadius',
            transformOrigin: '50% 50%',
          })

          const timeline = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: root,
              start: 'top top',
              end: () => `+=${window.innerHeight * (responsive.scrollDistanceVh / 100)}`,
              pin: stage,
              pinSpacing: true,
              scrub: HERO_CONFIG.scrubSmoothing,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                if (!introComplete) return
                if (HERO_CONFIG.scrubVideoFrames) {
                  scrubActiveVideo(self.progress)
                } else {
                  activateStage(stageAtProgress(self.progress).videoIndex, self.direction)
                }
              },
            },
          })

          timeline
            .to(holdClock, {
              progress: 1,
              duration: timelineConfig.end,
            }, 0)
            .to(introPanel, {
              x: responsive.shakeX,
              scale: responsive.shakeScale,
              duration: 0.48,
              repeat: 4,
              yoyo: true,
            }, timelineConfig.impactStart)
            .set(introPanel, { x: 0, scale: 1 })

          const finishIntro = () => {
            if (disposed) return
            introComplete = true
            root.classList.remove('is-intro-playing')
            root.classList.add('is-intro-complete')
            document.body.style.overflow = originalBodyOverflow
            sessionStorage.setItem('furfooHeroIntroPlayed', 'true')
            activateStage(stageAtProgress(timeline.scrollTrigger.progress).videoIndex, 1)
            ScrollTrigger.refresh()
          }

          const navigationEntry = performance.getEntriesByType('navigation')[0]
          const shouldPlayIntro = navigationEntry?.type === 'reload' ||
            !sessionStorage.getItem('furfooHeroIntroPlayed')

          introStartRef.current = () => {
            if (introHasStarted || disposed) return
            introHasStarted = true

            if (!shouldPlayIntro) {
              finishIntro()
              return
            }

            root.classList.add('is-intro-playing')
            document.body.style.overflow = 'hidden'

            gsap.set(introPanel, {
              scale: 1,
              opacity: 1,
              clearProps: 'borderRadius',
            })
            gsap.set(layers, { opacity: 0 })
            gsap.set(introLogoLayer, {
              opacity: 1,
              scale: responsive.introInitialScale,
              transformOrigin: '50% 50%',
            })
            gsap.set(introLogo, {
              x: 0,
              y: 58,
              opacity: 0,
              clipPath: 'inset(100% 0 0 0)',
            })
            videos.forEach((video) => video.pause())

            introTimeline = gsap.timeline({ onComplete: finishIntro })
              .to(introLogo, {
                x: 0,
                y: 0,
                opacity: 1,
                clipPath: 'inset(0 0% 0 0)',
                duration: HERO_CONFIG.intro.logoRiseDuration,
                ease: 'power2.out',
              })
              .to({}, { duration: HERO_CONFIG.intro.logoHoldDuration })
              .to(introLogo, {
                y: -16,
                opacity: 0,
                duration: HERO_CONFIG.intro.logoFadeDuration,
                ease: 'power2.in',
              })
              .to(introLogoLayer, {
                scale: 1,
                duration: HERO_CONFIG.intro.cardExpandDuration,
                ease: 'power3.inOut',
              })
              .call(() => activateStage(0, 1, true), [], '>')
              .to(layers[0], {
                opacity: 1,
                duration: HERO_CONFIG.intro.hachiCrossfadeDuration,
                ease: 'sine.inOut',
              }, '<')
              .to(introLogoLayer, {
                opacity: 0,
                duration: HERO_CONFIG.intro.hachiCrossfadeDuration,
                ease: 'sine.inOut',
              }, '<')

          }

          if (introLogoLayer?.querySelector('img')?.complete) {
            introAssetStatusRef.current.logo = true
          }
          startIntroWhenReady()

          return () => {
            introTimeline?.kill()
            timeline.scrollTrigger?.kill()
            timeline.kill()
            videos.forEach((video) => video.pause())
            document.body.style.overflow = originalBodyOverflow
            root.classList.remove('is-intro-playing', 'is-intro-complete')
            activeIndex = -1
          }
        },
      )

      document.fonts?.ready.then(() => {
        if (!disposed) ScrollTrigger.refresh()
      })

      return () => {
        disposed = true
        introStartRef.current = null
        document.body.style.overflow = originalBodyOverflow
        matchMedia.revert()
      }
    },
    { scope: rootRef },
  )

  const heroStyle = {
    '--furfoo-hero-background': HERO_CONFIG.background,
    '--furfoo-hero-position-desktop': HERO_CONFIG.desktop.objectPosition,
    '--furfoo-hero-position-mobile': HERO_CONFIG.mobile.objectPosition,
  }

  return (
    <section
      className="furfoo-scroll-hero"
      id="home"
      ref={rootRef}
      style={heroStyle}
      aria-label="Furfoo and Hachi introduction"
    >
      <div className="furfoo-scroll-hero__stage" ref={stageRef}>
        <div className="furfoo-scroll-hero__intro-panel" ref={introPanelRef}>
          <div className="furfoo-scroll-hero__fallback" aria-hidden="true" />

          <div className="furfoo-scroll-hero__intro-logo-layer" ref={introLogoLayerRef}>
            <img
              src={HERO_CONFIG.introLogo}
              alt="Furfoo — Where fur meets fortune"
              onLoad={handleIntroLogoReady}
              onError={handleIntroLogoError}
            />
          </div>

          {HERO_CONFIG.videos.map((video, index) => (
            <div
              className={`furfoo-scroll-hero__video-layer${failedVideos.has(index) ? ' is-failed' : ''}`}
              data-video-id={video.id}
              key={video.id}
            >
              <video
                ref={(element) => { videoRefs.current[index] = element }}
                muted
                playsInline
                preload={video.preload}
                poster={video.poster}
                aria-hidden="true"
                tabIndex={-1}
                onLoadedData={() => handleVideoReady(index)}
                onLoadedMetadata={refreshScrollTrigger}
                onCanPlay={() => handleVideoReady(index)}
                onError={() => handleVideoError(index)}
              >
                <source src={video.src} type="video/mp4" />
              </video>
            </div>
          ))}
        </div>

        <div
          className={`furfoo-scroll-hero__loader${introAssetReady ? ' is-ready' : ''}`}
          role="status"
          aria-live="polite"
        >
          <span>Preparing Furfoo</span>
        </div>

        <div className="furfoo-scroll-hero__brief">
          <p className="furfoo-scroll-hero__eyebrow">Natural treats · Thoughtful care</p>
          <h1>More good days,<br/>one treat at a time.</h1>
          <div className="furfoo-scroll-hero__brief-footer">
            <p>Small-batch favourites for pets who are family.</p>
            <Link className="furfoo-scroll-hero__cta" to="/shop">
              <span>Shop treats</span>
              <ArrowRight aria-hidden="true"/>
            </Link>
          </div>
        </div>

      </div>
    </section>
  )
}
