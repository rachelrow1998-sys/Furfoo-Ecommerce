import { PawPrint } from 'lucide-react'
import { hachiConfig } from './hachi.config'

function ImageRenderer({ state, onError }) {
  const src = hachiConfig.assets[state] || hachiConfig.assets.fallback
  return <img className="hachi-renderer__asset" src={src} alt="" loading="lazy" draggable="false" onError={onError}/>
}

function VideoRenderer({ state, onError }) {
  const src = hachiConfig.assets[state] || hachiConfig.assets.fallback
  return <video className="hachi-renderer__asset" src={src} muted playsInline autoPlay loop onError={onError}/>
}

function PlaceholderRenderer({ state }) {
  return <span className="hachi-renderer__placeholder" data-state={state}>
    <PawPrint aria-hidden="true"/><b>Hachi</b><small>Replaceable pet renderer</small>
    {state === 'sleeping' && <i aria-hidden="true">Z z</i>}
  </span>
}

const spritePoses = {
  idle: 'happy', entering: 'happy', walking: 'happy', running: 'happy', tailWagging: 'happy',
  hovered: 'happy', open: 'happy', wave: 'happy', excited: 'happy', celebrating: 'happy', success: 'happy',
  looking: 'tilt', blinking: 'tilt', sitting: 'tilt', waking: 'tilt', headTilting: 'tilt', peeking: 'tilt', listening: 'tilt',
  sniffing: 'sniff', guiding: 'sniff', recommending: 'sniff', returningHome: 'sniff',
  startled: 'surprised', jumping: 'surprised', error: 'surprised',
  thinking: 'thinking', speaking: 'thinking',
  lying: 'sleeping', sleeping: 'sleeping', minimized: 'sleeping',
}

const standalonePoses = {
  thinking: '/hachi/hachi-thinking-v3.png',
  speaking: '/hachi/hachi-thinking-v3.png',
  lying: '/hachi/hachi-sleeping-v3.png',
  sleeping: '/hachi/hachi-sleeping-v3.png',
  minimized: '/hachi/hachi-sleeping-v3.png',
}

function SpriteRenderer({ state, onError }) {
  const standalone = standalonePoses[state]
  if (standalone) return <img className="hachi-renderer__asset hachi-renderer__asset--standalone" src={standalone} alt="" draggable="false" onError={onError}/>
  const pose = spritePoses[state] || 'happy'
  return <span
    className="hachi-renderer__sprite"
    data-pose={pose}
    style={{ backgroundImage: `url(${hachiConfig.spriteSheet})` }}
  />
}

const renderers = { image: ImageRenderer, video: VideoRenderer, sprite: SpriteRenderer, placeholder: PlaceholderRenderer }

export default function HachiRenderer({ state, failed, onError }) {
  // Add SpriteRenderer, LottieRenderer, RiveRenderer or ThreeModelRenderer here.
  // Behaviour and movement code intentionally know nothing about the file format.
  const Renderer = failed ? PlaceholderRenderer : (renderers[hachiConfig.renderer] || PlaceholderRenderer)
  return <span className="hachi-renderer" aria-hidden="true"><Renderer state={state} onError={onError}/></span>
}
