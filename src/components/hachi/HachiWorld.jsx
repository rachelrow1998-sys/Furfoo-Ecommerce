import HachiAssistant from './HachiAssistant'

// The world layer is mounted once. It owns the single persistent Hachi character,
// while HachiAssistant supplies the existing guided product and support flows.
export default function HachiWorld() {
  return <HachiAssistant worldMode/>
}
