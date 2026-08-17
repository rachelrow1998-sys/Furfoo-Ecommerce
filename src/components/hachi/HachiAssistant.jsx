import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import {
  ArrowLeft, Bone, ChevronRight, HeartHandshake, HelpCircle, Home,
  EyeOff, Gauge, MessageCircle, MoreHorizontal, PawPrint,
  RotateCcw, Send, Settings, Sparkles, Stethoscope, Truck,
  Volume2, VolumeX, X, Moon, GripHorizontal,
} from 'lucide-react'
import { hachiConfig } from './hachi.config'
import { hachiProducts, recommendBath, recommendTreat } from './hachi.products'
import { hachiFaqs } from './hachi.faqs'
import { hachiAdoptions } from './hachi.adoptions'
import { hasUrgentHealthTerms, sendMessageToHachi, trackHachiEvent, whatsappUrl } from './hachi.utils'
import HachiRenderer from './HachiRenderer'
import { chooseWeightedBehaviour } from './hachi.behaviours'
import { findNearestValidPosition, findSectionAnchor, getRestrictedZones } from './hachi.movement'
import { isSiteSoundEnabled, playSiteSound, setSiteSoundEnabled, stopSiteSound, subscribeSiteSound } from '../../utils/siteSound'
import './hachi.css'

const WELCOME_KEY = 'furfoo_hachi_welcome_seen'
const PROACTIVE_COUNT_KEY = 'furfoo_hachi_prompt_count'
const PROACTIVE_TIME_KEY = 'furfoo_hachi_prompt_time'
const EXIT_KEY = 'furfoo_hachi_exit_seen'
const USED_KEY = 'furfoo_hachi_used'
const HIDDEN_KEY = 'furfoo_hachi_hidden'
const INTERACTION_KEY = 'furfoo_hachi_interaction_level'
const POSITION_KEY = 'furfoo_hachi_position'
const PANEL_POSITION_KEY = 'furfoo_hachi_panel_position'

function clampPetPosition(position, size = { width: 132, height: 142 }) {
  const padding = hachiConfig.movementPadding
  return {
    x: Math.min(Math.max(padding, position.x), Math.max(padding, window.innerWidth - size.width - padding)),
    y: Math.min(Math.max(padding, position.y), Math.max(padding, window.innerHeight - size.height - padding)),
  }
}

function loadPetPosition(size = { width: 132, height: 142 }) {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY))
    if (Number.isFinite(saved?.xRatio) && Number.isFinite(saved?.yRatio)) {
      return clampPetPosition({
        x: saved.xRatio * Math.max(1, window.innerWidth - size.width),
        y: saved.yRatio * Math.max(1, window.innerHeight - size.height),
      }, size)
    }
  } catch { /* Ignore invalid legacy values. */ }
  return clampPetPosition({ x: window.innerWidth - size.width - 22, y: window.innerHeight - size.height - 18 }, size)
}

function savePetPosition(position, size = { width: 132, height: 142 }) {
  localStorage.setItem(POSITION_KEY, JSON.stringify({
    xRatio: position.x / Math.max(1, window.innerWidth - size.width),
    yRatio: position.y / Math.max(1, window.innerHeight - size.height),
  }))
}

function getPanelSize() {
  return {
    width: Math.min(400, Math.max(288, window.innerWidth - 32)),
    height: Math.min(680, Math.max(420, window.innerHeight - 128)),
  }
}

function clampPanelPosition(position, size = getPanelSize()) {
  const padding = 12
  return {
    x: Math.min(Math.max(padding, position.x), Math.max(padding, window.innerWidth - size.width - padding)),
    y: Math.min(Math.max(padding, position.y), Math.max(padding, window.innerHeight - size.height - padding)),
  }
}

function defaultPanelPosition(size = getPanelSize()) {
  return clampPanelPosition({
    x: window.innerWidth - size.width - 20,
    y: Math.max(12, Math.min(124, window.innerHeight - size.height - 12)),
  }, size)
}

function loadPanelPosition(size = getPanelSize()) {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY))
    if (Number.isFinite(saved?.xRatio) && Number.isFinite(saved?.yRatio)) {
      return clampPanelPosition({
        x: saved.xRatio * Math.max(1, window.innerWidth - size.width),
        y: saved.yRatio * Math.max(1, window.innerHeight - size.height),
      }, size)
    }
  } catch { /* Ignore invalid saved values. */ }
  return defaultPanelPosition(size)
}

function savePanelPosition(position, size = getPanelSize()) {
  localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify({
    xRatio: position.x / Math.max(1, window.innerWidth - size.width),
    yRatio: position.y / Math.max(1, window.innerHeight - size.height),
  }))
}

const bathConcerns = [
  ['itchy', 'Itchy or sensitive skin'], ['red-spots', 'Red spots or dandruff'],
  ['dry-coat', 'Dry coat or shedding'], ['odour', 'Strong body odour'],
  ['bugs', 'Outdoor bugs'], ['anxiety', 'Anxiety or restlessness'],
  ['maintenance', 'General coat maintenance'], ['unsure', "I'm not sure"],
]

const menuActions = [
  { label: 'Find the right herbal bath', icon: Sparkles, screen: 'bath-intro' },
  { label: 'Choose treats for my pet', icon: Bone, screen: 'treat-intro' },
  { label: 'Ask about skin or coat concerns', icon: Stethoscope, screen: 'bath-intro' },
  { label: 'Delivery and ordering', icon: Truck, screen: 'faq' },
  { label: 'Learn about Furfoo', icon: Home, screen: 'about' },
  { label: "Meet Hachi's adoption friends", icon: HeartHandshake, screen: 'adoption' },
  { label: 'Talk to Furfoo', icon: MessageCircle, screen: 'contact' },
]

function QuickReplies({ children }) {
  return <div className="hachi-quick-replies">{children}</div>
}

function QuickButton({ children, icon: Icon, onClick, secondary = false }) {
  return <button type="button" className={`hachi-quick-button${secondary ? ' is-secondary' : ''}`} onClick={onClick}>
    {Icon && <Icon aria-hidden="true"/>}<span>{children}</span><ChevronRight aria-hidden="true"/>
  </button>
}

function WhatsAppButton({ message, children = 'WhatsApp Furfoo', onClick }) {
  const href = whatsappUrl(hachiConfig.whatsappNumber, message || hachiConfig.defaultWhatsappMessage)
  return <a className="hachi-action hachi-action--whatsapp" href={href} target="_blank" rel="noopener noreferrer" onClick={() => {
    trackHachiEvent('hachi_whatsapp_clicked', { context: children })
    onClick?.()
  }}><MessageCircle aria-hidden="true"/>{children}</a>
}

function ProductCard({ product, reason, onNavigate, onAskAnother }) {
  const stockMessage = `Hi Furfoo, I would like to check the availability of ${product.name}.`
  const enquiry = `Hi Furfoo, Hachi recommended ${product.name} for my furkid. I would like to know more.`
  const match = product.recommendation
  return <article className={`hachi-product-card${product.available ? '' : ' is-unavailable'}`}>
    <img src={product.image} alt="" loading="lazy"/>
    <div className="hachi-product-card__copy">
      <div className="hachi-card-title-row"><h4>{product.name}</h4><span>{product.available ? 'Available' : 'Unavailable'}</span></div>
      <p>{product.available ? product.description : `${product.name} is currently unavailable, but Hachi can help you contact Furfoo for the latest stock update.`}</p>
      {product.suitedFor && <small><strong>Best suited for:</strong> {product.suitedFor}</small>}
      {match && <><div className="hachi-match"><span className="hachi-match__score">{match.matchPercent}% match</span><span className="hachi-match__label">Rule-based fit from verified catalogue fields</span></div><ul className="hachi-match-reasons">{match.reasons.map(item => <li key={item}>{item}</li>)}</ul><p className="hachi-data-note"><strong>Data used:</strong> {match.dataUsed.join(', ')}. No sales or popularity claims are used.</p>{match.caution && <small className="hachi-caution">{match.caution}</small>}</>}
      {!match && reason && <small>{reason}</small>}
      <div className="hachi-card-actions">
        {product.available && <button type="button" onClick={() => onNavigate(product)}>View Product</button>}
        <button type="button" onClick={onAskAnother}>Ask Another Question</button>
        <WhatsAppButton message={product.available ? enquiry : stockMessage}>{product.available ? 'WhatsApp Furfoo' : 'Check stock'}</WhatsAppButton>
      </div>
    </div>
  </article>
}

function AdoptionCard({ pet, onMeet }) {
  return <article className="hachi-adoption-card">
    <img src={pet.image} alt={`${pet.name}, a ${pet.species.toLowerCase()} looking for a home`} loading="lazy"/>
    <div><div className="hachi-card-title-row"><h4>{pet.name}</h4><span>{pet.status}</span></div>
      <p>{pet.species} · {pet.gender} · {pet.age}<br/>{pet.personality} · {pet.location}</p>
      <button type="button" onClick={() => onMeet(pet)}>Meet {pet.name}</button>
      <WhatsAppButton message={`Hi Furfoo, I would like to know more about adopting ${pet.name}.`} onClick={() => trackHachiEvent('hachi_adoption_clicked', { pet: pet.name })}>Ask About Adoption</WhatsAppButton>
    </div>
  </article>
}

function SafetyNotice() {
  return <p className="hachi-safety"><Stethoscope aria-hidden="true"/>{hachiConfig.healthDisclaimer}</p>
}

function HachiContent({ screen, setScreen, bathAnswers, setBathAnswers, treatAnswers, setTreatAnswers, selectedFaq, setSelectedFaq, selectedPet, setSelectedPet, navigateToProduct }) {
  const bathResults = useMemo(() => recommendBath(bathAnswers.concern), [bathAnswers.concern])
  const treatResults = useMemo(() => recommendTreat(treatAnswers), [treatAnswers])
  useEffect(() => {
    if (screen === 'bath-result' && bathResults.length) trackHachiEvent('hachi_product_recommended', { productIds: bathResults.map(product => product.id) })
    if (screen === 'treat-result' && treatResults.length) trackHachiEvent('hachi_product_recommended', { productIds: treatResults.map(product => product.id) })
    if (screen === 'bath-result' && bathResults.length) window.dispatchEvent(new CustomEvent('hachi:recommend', { detail: { product: bathResults[0] } }))
    if (screen === 'treat-result' && treatResults.length) window.dispatchEvent(new CustomEvent('hachi:recommend', { detail: { product: treatResults[0] } }))
    if (screen === 'bath-result' && bathResults.length) sessionStorage.setItem('furfoo_hachi_last_recommended_product', bathResults[0].id)
    if (screen === 'treat-result' && treatResults.length) sessionStorage.setItem('furfoo_hachi_last_recommended_product', treatResults[0].id)
  }, [bathResults, screen, treatResults])
  const setBath = (key, value, next) => { setBathAnswers(current => ({ ...current, [key]: value })); setScreen(next) }
  const setTreat = (key, value, next) => { setTreatAnswers(current => ({ ...current, [key]: value })); setScreen(next) }

  if (screen === 'menu') return <><div className="hachi-message"><PawPrint/><div><strong>What can Hachi help you with?</strong><p>Pick a path and we'll take it one paw at a time.</p></div></div><QuickReplies>{menuActions.map(item => <QuickButton key={item.label} icon={item.icon} onClick={() => setScreen(item.screen)}>{item.label}</QuickButton>)}</QuickReplies></>
  if (screen === 'bath-intro') return <><div className="hachi-message"><Sparkles/><div><strong>Let Hachi find the right herbal bath for your furkid.</strong><p>Four quick questions, then I'll share a gentle starting point.</p></div></div><button className="hachi-action" type="button" onClick={() => { trackHachiEvent('hachi_quiz_started', { quiz: 'bath' }); setScreen('bath-pet') }}>Start the bath quiz</button><SafetyNotice/></>
  if (screen === 'bath-pet') return <Question title="Who are we shopping for?" options={[['dog', 'Dog'], ['cat', 'Cat']]} onChoose={(value) => setBath('petType', value, 'bath-concern')}/>
  if (screen === 'bath-concern') return <Question title="What is the main concern?" options={bathConcerns} onChoose={(value) => setBath('concern', value, 'bath-duration')}/>
  if (screen === 'bath-duration') return <Question title="How long has this been happening?" options={[['started', 'Just started'], ['days', 'A few days'], ['weeks', 'A few weeks'], ['recurring', 'It keeps coming back']]} onChoose={(value) => setBath('duration', value, 'bath-safety')}/>
  if (screen === 'bath-safety') return <><Question title="Is there any open wound, bleeding, swelling, or severe discomfort?" options={[['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]} onChoose={(value) => {
    setBathAnswers(current => ({ ...current, safety: value }))
    setScreen(value === 'no' ? 'bath-result' : 'bath-vet')
    if (value === 'no') trackHachiEvent('hachi_quiz_completed', { quiz: 'bath', concern: bathAnswers.concern })
  }}/><SafetyNotice/></>
  if (screen === 'bath-vet') return <><div className="hachi-message is-warning"><Stethoscope/><div><strong>Let's put safety first.</strong><p>Hachi thinks it's safer to check with a veterinarian first, especially if there is an open wound, swelling, bleeding, or severe discomfort.</p></div></div><WhatsAppButton>Contact Furfoo</WhatsAppButton><button className="hachi-action hachi-action--secondary" type="button" onClick={() => setScreen('bath-intro')}><RotateCcw/>Restart Quiz</button><SafetyNotice/></>
  if (screen === 'bath-result') return <><div className="hachi-message is-success"><Sparkles/><div><strong>Hachi found a match!</strong><p>{bathAnswers.concern === 'itchy' || bathAnswers.concern === 'red-spots' ? 'Hachi thinks Itch-Off may be the best place to start for itchy, irritated, or sensitive skin. Once the skin condition becomes more stable, a gentle coat-maintenance option may be considered.' : 'Here is a gentle match based on what you shared.'}</p></div></div>{bathResults.map(product => <ProductCard key={product.id} product={product} onNavigate={navigateToProduct} onAskAnother={() => setScreen('menu')}/>) }<SafetyNotice/></>
  if (screen === 'treat-intro') return <><div className="hachi-message"><Bone/><div><strong>Let's find your furkid's next favourite treat.</strong><p>No crumbs on the keyboard, promise.</p></div></div><button className="hachi-action" type="button" onClick={() => { trackHachiEvent('hachi_quiz_started', { quiz: 'treat' }); setScreen('treat-pet') }}>Start the treat quiz</button></>
  if (screen === 'treat-pet') return <Question title="Who is the treat for?" options={[['dog', 'Dog'], ['cat', 'Cat']]} onChoose={(value) => setTreat('petType', value, 'treat-texture')}/>
  if (screen === 'treat-texture') return <Question title="What texture do they prefer?" options={[['crunchy', 'Crunchy'], ['chewy', 'Chewy'], ['light', 'Light and crispy'], ['unsure', 'Not sure']]} onChoose={(value) => setTreat('texture', value, 'treat-flavour')}/>
  if (screen === 'treat-flavour') return <Question title="Which flavour sounds best?" options={['chicken', 'duck', 'salmon', 'beef', 'lamb', 'ostrich', 'surprise'].map(item => [item, item === 'surprise' ? 'Surprise me' : `${item[0].toUpperCase()}${item.slice(1)}`])} onChoose={(value) => setTreat('flavour', value, 'treat-avoid')}/>
  if (screen === 'treat-avoid') return <Question title="Any ingredients you want to avoid?" options={[['none', 'No'], ['chicken', 'Chicken'], ['beef', 'Beef'], ['salmon', 'Fish'], ['other', 'Other']]} onChoose={(value) => setTreat('avoid', value, 'treat-goal')}/>
  if (screen === 'treat-goal') return <Question title="What matters most for this treat?" options={[['training', 'Training reward'], ['dental', 'Dental care'], ['digestion', 'Happy tummy'], ['coat', 'Skin and coat'], ['energy', 'Daily energy'], ['everyday', 'Everyday treat'], ['unsure', 'No preference']]} onChoose={(value) => { setTreatAnswers(current => ({ ...current, goal: value })); setScreen('treat-result'); trackHachiEvent('hachi_quiz_completed', { quiz: 'treat', goal: value }) }}/>
  if (screen === 'treat-result') return <><div className={`hachi-message ${treatResults.length ? 'is-success' : 'is-warning'}`}><Sparkles/><div><strong>{treatResults.length ? 'Hachi found a data-backed match!' : 'No safe catalogue match found'}</strong><p>{treatResults.length ? 'Hachi first removed products that conflict with pet type, availability, or your avoid list, then scored the remaining products by texture, flavour, goal, ingredients, and price.' : 'The current catalogue does not have a listed-available option that passes those hard filters. Try another preference or ask Furfoo to verify ingredients and stock.'}</p></div></div>{treatResults.map(product => <ProductCard key={product.id} product={product} onNavigate={navigateToProduct} onAskAnother={() => setScreen('menu')}/>)}</>
  if (screen === 'about') return <><div className="hachi-message"><HeartHandshake/><div><strong>Made from love for our own furkids.</strong><p>Furfoo was created from the love we share with our own furkids. Our products are made with care in small batches, from handmade treats to herbal bath blends and gentle pet-care essentials.</p></div></div><QuickReplies><QuickButton onClick={() => setScreen('treat-intro')}>Our handmade treats</QuickButton><QuickButton onClick={() => setScreen('bath-intro')}>Herbal bath collection</QuickButton><QuickButton onClick={() => setScreen('essentials')}>Pet-care essentials</QuickButton><QuickButton onClick={() => setScreen('small-batch')}>Why small-batch matters</QuickButton></QuickReplies><button className="hachi-action hachi-action--secondary" type="button" onClick={() => navigateToProduct({ url: '/#story', name: 'Our Story' })}>Read Our Story</button></>
  if (screen === 'small-batch' || screen === 'essentials') return <><div className="hachi-message"><Sparkles/><div><strong>{screen === 'small-batch' ? 'Why small-batch matters' : 'Pet-care essentials'}</strong><p>{screen === 'small-batch' ? 'Small batches help Furfoo make thoughtfully, keep a close eye on quality, and share fresher products with furkids.' : 'Furfoo keeps daily care gentle and easy to understand, with thoughtful products for real pet routines.'}</p></div></div><button className="hachi-action hachi-action--secondary" onClick={() => setScreen('about')}><ArrowLeft/>Back to Furfoo</button></>
  if (screen === 'faq') return <><div className="hachi-message"><Truck/><div><strong>Delivery, ordering, and good-to-know things.</strong><p>Choose a question below.</p></div></div><QuickReplies>{hachiFaqs.map(faq => <QuickButton key={faq.id} icon={HelpCircle} onClick={() => { setSelectedFaq(faq); setScreen('faq-answer') }}>{faq.question}</QuickButton>)}</QuickReplies></>
  if (screen === 'faq-answer' && selectedFaq) return <><div className="hachi-message"><HelpCircle/><div><strong>{selectedFaq.question}</strong><p>{selectedFaq.answer}</p></div></div><WhatsAppButton/><button className="hachi-action hachi-action--secondary" type="button" onClick={() => setScreen('faq')}><ArrowLeft/>More questions</button></>
  if (screen === 'adoption') return <><div className="hachi-message"><HeartHandshake/><div><strong>Hachi's friends are looking for a loving home.</strong><p>Every enquiry is handled by a person, with the animal's wellbeing first.</p></div></div><div className="hachi-card-list">{hachiAdoptions.slice(0, 5).map(pet => <AdoptionCard key={pet.name} pet={pet} onMeet={(value) => { setSelectedPet(value); setScreen('adoption-detail') }}/>)}</div></>
  if (screen === 'adoption-detail' && selectedPet) return <><div className="hachi-adoption-detail"><img src={selectedPet.image} alt={selectedPet.name}/><h3>Meet {selectedPet.name}</h3><p>{selectedPet.introduction}</p><dl><div><dt>Vaccination</dt><dd>{selectedPet.vaccination}</dd></div><div><dt>Neutering</dt><dd>{selectedPet.neutering}</dd></div><div><dt>Suitable home</dt><dd>{selectedPet.home}</dd></div><div><dt>Contact</dt><dd>{selectedPet.contact}</dd></div></dl></div><WhatsAppButton message={`Hi Furfoo, I would like to know more about adopting ${selectedPet.name}.`}>Ask About Adoption</WhatsAppButton><button className="hachi-action hachi-action--secondary" type="button" onClick={() => setScreen('adoption')}><ArrowLeft/>Back to friends</button></>
  if (screen === 'urgent') return <><div className="hachi-message is-urgent"><Stethoscope/><div><strong>Please get professional help now.</strong><p>{hachiConfig.urgentResponse}</p></div></div><SafetyNotice/></>
  if (screen === 'unsupported') return <><div className="hachi-message"><PawPrint/><div><strong>Hachi is still learning this one.</strong><p>Would you like to ask the Furfoo team?</p></div></div><WhatsAppButton/><button className="hachi-action hachi-action--secondary" type="button" onClick={() => setScreen('menu')}><Home/>Back to Main Menu</button></>
  if (screen === 'ask') return <><div className="hachi-message"><PawPrint/><div><strong>Hachi is listening.</strong><p>Type a question below. I know the Furfoo basics, and I can fetch a human when I am unsure.</p></div></div><QuickReplies><QuickButton onClick={() => setScreen('faq')}>Delivery and ordering questions</QuickButton><QuickButton onClick={() => setScreen('about')}>About Furfoo</QuickButton></QuickReplies></>
  if (screen === 'contact') return <><div className="hachi-message"><MessageCircle/><div><strong>The Furfoo team is one tap away.</strong><p>Tell them Hachi sent you. I might get a treat for this.</p></div></div><WhatsAppButton/></>
  return null
}

function Question({ title, options, onChoose }) {
  return <><div className="hachi-message"><PawPrint/><div><strong>{title}</strong><p>Choose the closest answer.</p></div></div><QuickReplies>{options.map(([value, label]) => <QuickButton key={value} onClick={() => onChoose(value)}>{label}</QuickButton>)}</QuickReplies></>
}

export default function HachiAssistant() {
  const location = useLocation()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState(() => sessionStorage.getItem('furfoo_hachi_current_flow') || 'menu')
  const [visualState, setVisualState] = useState('idle')
  const [welcome, setWelcome] = useState(false)
  const [prompt, setPrompt] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(() => isSiteSoundEnabled(hachiConfig.soundEnabledByDefault))
  const [imageFailed, setImageFailed] = useState(false)
  const [bathAnswers, setBathAnswers] = useState({})
  const [treatAnswers, setTreatAnswers] = useState({})
  const [selectedFaq, setSelectedFaq] = useState(null)
  const [selectedPet, setSelectedPet] = useState(null)
  const [input, setInput] = useState('')
  const [petMenu, setPetMenu] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hideConfirm, setHideConfirm] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [panelDragging, setPanelDragging] = useState(false)
  const [mobileViewport, setMobileViewport] = useState(() => window.innerWidth <= 700)
  const [panelPosition, setPanelPosition] = useState(() => loadPanelPosition())
  const [resting, setResting] = useState(() => sessionStorage.getItem('furfoo_hachi_resting') === 'true')
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDDEN_KEY) === 'true')
  const [reducedInteraction, setReducedInteraction] = useState(() => localStorage.getItem(INTERACTION_KEY) === 'reduced')
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [currentSection, setCurrentSection] = useState('hero')
  const [heroActive, setHeroActive] = useState(() => location.pathname === '/' && window.scrollY < window.innerHeight * .7)
  const [position, setPosition] = useState(() => loadPetPosition())
  const [target, setTarget] = useState(position)
  const [facing, setFacing] = useState('left')
  const [activeBehaviour, setActiveBehaviour] = useState('entering')
  const triggerRef = useRef(null)
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const audioRef = useRef(null)
  const barkAudioRef = useRef(null)
  const movementTweenRef = useRef(null)
  const positionRef = useRef(position)
  const autonomousTimerRef = useRef(null)
  const cursorTimerRef = useRef(null)
  const scrollTimerRef = useRef(null)
  const lastAutonomousRef = useRef('idle')
  const lastCursorReactionRef = useRef(0)
  const visibleRef = useRef(!document.hidden)
  const worldInitializedRef = useRef(false)
  const interactionLockRef = useRef(0)
  const dragRef = useRef(null)
  const longPressRef = useRef(null)
  const suppressClickRef = useRef(false)
  const expressionIndexRef = useRef(0)
  const panelDragRef = useRef(null)

  const isCheckoutContext = useCallback(() => location.pathname.includes('checkout') || document.querySelector('.cart-drawer.is-open'), [location.pathname])

  const moveTo = useCallback((desired, options = {}) => {
    const root = rootRef.current
    if (!root || hidden || open || resting || !visibleRef.current) return
    if (!options.force && Date.now() < interactionLockRef.current && /^(autonomous|section|scroll)/.test(options.behaviour || '')) return
    const size = { width: root.offsetWidth || 132, height: root.offsetHeight || 142 }
    const next = findNearestValidPosition(desired, size, getRestrictedZones(root), hachiConfig.movementPadding)
    const currentX = Number(gsap.getProperty(root, 'x')) || positionRef.current.x
    const currentY = Number(gsap.getProperty(root, 'y')) || positionRef.current.y
    const distance = Math.hypot(next.x - currentX, next.y - currentY)
    const running = distance > Math.min(360, window.innerWidth * 0.35)
    const reducedMotion = reducedInteraction || systemReducedMotion
    const movementState = reducedMotion ? 'idle' : running ? 'running' : 'walking'
    const speed = running ? hachiConfig.runningSpeed : hachiConfig.walkingSpeed
    const duration = reducedMotion ? 0.01 : Math.max(.45, Math.min(2.4, distance / speed))
    movementTweenRef.current?.kill()
    setFacing(next.x >= currentX ? 'right' : 'left')
    setTarget(next)
    setVisualState(movementState)
    setActiveBehaviour(options.behaviour || movementState)
    movementTweenRef.current = gsap.to(root, {
      x: next.x,
      y: next.y,
      duration,
      ease: running ? 'power2.inOut' : 'sine.inOut',
      overwrite: true,
      onComplete: () => {
        positionRef.current = next
        setPosition(next)
        setVisualState(options.arrivalState || 'idle')
        setActiveBehaviour(options.arrivalState || 'idle')
      },
    })
  }, [hidden, open, reducedInteraction, resting, systemReducedMotion])

  useEffect(() => {
    const check = () => {
      const hero = document.querySelector('.furfoo-scroll-hero')
      if (!hero || hero.classList.contains('is-intro-complete') || sessionStorage.getItem('furfooHeroIntroPlayed')) {
        window.setTimeout(() => setReady(true), 800)
        return true
      }
      return false
    }
    if (check()) return
    const timer = window.setInterval(() => { if (check()) window.clearInterval(timer) }, 400)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!ready || localStorage.getItem(WELCOME_KEY)) return
    const timer = window.setTimeout(() => setWelcome(true), 900)
    return () => window.clearTimeout(timer)
  }, [ready])

  useEffect(() => {
    if (!welcome) return
    const timer = window.setTimeout(() => {
      localStorage.setItem(WELCOME_KEY, 'true')
      setWelcome(false)
      setVisualState('idle')
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [welcome])

  useEffect(() => {
    if (location.pathname !== '/') { setHeroActive(false); return }
    const hero = document.querySelector('.furfoo-scroll-hero')
    if (!hero) { setHeroActive(false); return }
    const observer = new IntersectionObserver(entries => {
      const active = entries[0].isIntersecting && entries[0].intersectionRatio > .32
      setHeroActive(active)
      if (!active) {
        setVisualState('entering')
        setActiveBehaviour('hero-exit:entering-world')
      }
    }, { threshold: [0, .32, .6] })
    observer.observe(hero)
    return () => observer.disconnect()
  }, [location.pathname])

  useEffect(() => {
    if (!ready || !rootRef.current || worldInitializedRef.current) return
    worldInitializedRef.current = true
    const size = { width: rootRef.current.offsetWidth || 132, height: rootRef.current.offsetHeight || 142 }
    const start = loadPetPosition(size)
    gsap.set(rootRef.current, { x: start.x, y: start.y, opacity: 0 })
    positionRef.current = start
    setPosition(start)
    setVisualState(resting ? 'sleeping' : 'idle')
    setActiveBehaviour(resting ? 'sleeping' : 'ready:draggable')
    gsap.to(rootRef.current, { opacity: 1, duration: systemReducedMotion ? 0 : .35, ease: 'power1.out' })
    return () => movementTweenRef.current?.kill()
  }, [ready, resting, systemReducedMotion])

  useEffect(() => {
    if (!ready || !hachiConfig.enableSectionInteractions) return
    const observers = []
    hachiConfig.sectionInteractions.forEach(interaction => {
      const element = document.querySelector(interaction.selector)
      if (!element) return
      const observer = new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting || open || hidden) return
        setCurrentSection(interaction.id)
        if (Date.now() < interactionLockRef.current) return
        const root = rootRef.current
        if (!root) return
        const size = { width: root.offsetWidth || 132, height: root.offsetHeight || 142 }
        const next = findSectionAnchor(interaction.anchor, size, root)
        if (interaction.id === 'footer') {
          movementTweenRef.current?.kill()
          moveTo(next, { behaviour: 'returningHome', arrivalState: 'sleeping' })
          return
        }
        moveTo(next, { behaviour: 'section', arrivalState: interaction.state })
        const count = Number(sessionStorage.getItem(PROACTIVE_COUNT_KEY) || 0)
        const lastTime = Number(sessionStorage.getItem(PROACTIVE_TIME_KEY) || 0)
        const alreadyShown = sessionStorage.getItem(`furfoo_hachi_section_${interaction.id}`)
        const formActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
        if (!resting && !reducedInteraction && !prompt && !petMenu && !welcome && !alreadyShown && !formActive && !isCheckoutContext() && count < hachiConfig.maxProactivePromptsPerSession && Date.now() - lastTime >= hachiConfig.proactivePromptGapMs) {
          setPrompt(interaction)
          setVisualState('speaking')
          sessionStorage.setItem(`furfoo_hachi_section_${interaction.id}`, 'true')
          sessionStorage.setItem(PROACTIVE_COUNT_KEY, String(count + 1))
          sessionStorage.setItem(PROACTIVE_TIME_KEY, String(Date.now()))
        }
      }, { threshold: interaction.id === 'footer' ? .2 : .35 })
      observer.observe(element)
      observers.push(observer)
    })
    return () => observers.forEach(observer => observer.disconnect())
  }, [hidden, isCheckoutContext, moveTo, open, petMenu, prompt, ready, reducedInteraction, resting, welcome])

  useEffect(() => {
    if (!ready || !hachiConfig.enableAutonomousMovement || open || hidden || resting || reducedInteraction || systemReducedMotion) return
    const schedule = () => {
      const [minimum, maximum] = hachiConfig.autonomousDelayRangeMs
      autonomousTimerRef.current = window.setTimeout(() => {
        if (!visibleRef.current || document.hidden || Date.now() < interactionLockRef.current) return schedule()
        const behaviour = chooseWeightedBehaviour(lastAutonomousRef.current)
        lastAutonomousRef.current = behaviour.state
        setVisualState(behaviour.state)
        setActiveBehaviour(`autonomous:${behaviour.state}`)
        if (behaviour.moves && rootRef.current) {
          const range = window.innerWidth <= 700 ? 75 : 180
          moveTo({ x: position.x + (Math.random() - .5) * range * 2, y: position.y + (Math.random() - .5) * 36 }, { behaviour: 'autonomous:walk', arrivalState: 'sitting' })
        } else if (behaviour.state !== 'sleeping') {
          window.setTimeout(() => { if (!open && !resting && Date.now() >= interactionLockRef.current) setVisualState('idle') }, 2600)
        }
        schedule()
      }, minimum + Math.random() * (maximum - minimum))
    }
    schedule()
    return () => window.clearTimeout(autonomousTimerRef.current)
  }, [hidden, moveTo, open, position.x, position.y, ready, reducedInteraction, resting, systemReducedMotion])

  useEffect(() => {
    if (!ready || !hachiConfig.enableCursorReactions || reducedInteraction || systemReducedMotion || window.innerWidth <= 700) return
    const onPointerMove = event => {
      if (open || hidden || resting || dragging || Date.now() < interactionLockRef.current || Date.now() - lastCursorReactionRef.current < 10000) return
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const centreX = rect.left + rect.width / 2
      const centreY = rect.top + rect.height / 2
      setFacing(event.clientX >= centreX ? 'right' : 'left')
      window.clearTimeout(cursorTimerRef.current)
      if (Math.hypot(event.clientX - centreX, event.clientY - centreY) < 230) {
        cursorTimerRef.current = window.setTimeout(() => {
          lastCursorReactionRef.current = Date.now()
          setVisualState('headTilting')
          setActiveBehaviour('cursor:duck-watch')
        }, 700)
      }
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => { window.removeEventListener('pointermove', onPointerMove); window.clearTimeout(cursorTimerRef.current) }
  }, [dragging, hidden, open, ready, reducedInteraction, resting, systemReducedMotion])

  useEffect(() => {
    const onVisibility = () => {
      visibleRef.current = !document.hidden
      if (document.hidden) movementTweenRef.current?.pause()
      else movementTweenRef.current?.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = event => {
      setSystemReducedMotion(event.matches)
      movementTweenRef.current?.kill()
      if (event.matches) { setVisualState('sitting'); setActiveBehaviour('system:reduced-motion') }
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!ready || !hachiConfig.enableAutonomousMovement) return
    let lastY = window.scrollY
    const onScroll = () => {
      const direction = window.scrollY >= lastY ? 'down' : 'up'
      lastY = window.scrollY
      window.clearTimeout(scrollTimerRef.current)
      if (!open && !resting && !hidden && Date.now() >= interactionLockRef.current) {
        setFacing(direction === 'down' ? 'right' : 'left')
        setActiveBehaviour(`scroll:${direction}`)
      }
      scrollTimerRef.current = window.setTimeout(() => {
        const root = rootRef.current
        if (!root || open || resting || hidden || Date.now() < interactionLockRef.current) return
        setActiveBehaviour('idle')
        const size = { width: root.offsetWidth, height: root.offsetHeight }
        const safe = findNearestValidPosition(positionRef.current, size, getRestrictedZones(root), hachiConfig.movementPadding)
        if (Math.hypot(safe.x - positionRef.current.x, safe.y - positionRef.current.y) > 8) moveTo(safe, { behaviour: 'scroll:settle-safe-zone', arrivalState: 'looking' })
      }, 280)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(scrollTimerRef.current) }
  }, [hidden, moveTo, open, ready, resting])

  useEffect(() => {
    const onRecommendation = event => {
      if (hidden) return
      interactionLockRef.current = Date.now() + 4200
      setVisualState('thinking')
      setActiveBehaviour('recommendation:thinking')
      const product = event.detail?.product
      window.setTimeout(() => {
        setVisualState('recommending')
        setActiveBehaviour('recommendation:found')
        const link = product?.url ? document.querySelector(`a[href="${product.url}"]`) : null
        const card = link?.closest('.product-card, .product-reel-slide')
        if (!card || !rootRef.current) return
        card.classList.add('hachi-recommended-highlight')
        if (open) { window.setTimeout(() => card.classList.remove('hachi-recommended-highlight'), 4200); return }
        const rect = card.getBoundingClientRect()
        const root = rootRef.current
        if (hachiConfig.enableAutonomousMovement) moveTo({ x: Math.max(18, rect.left - root.offsetWidth - 12), y: Math.min(window.innerHeight - root.offsetHeight - 18, rect.bottom - root.offsetHeight) }, { behaviour: 'product-guidance', arrivalState: 'celebrating' })
        window.setTimeout(() => card.classList.remove('hachi-recommended-highlight'), 4200)
      }, 850)
    }
    window.addEventListener('hachi:recommend', onRecommendation)
    return () => window.removeEventListener('hachi:recommend', onRecommendation)
  }, [hidden, moveTo, open])

  useEffect(() => {
    if (!ready || hidden || resting || !hachiConfig.enableSectionInteractions) return
    movementTweenRef.current?.kill()
    setVisualState('entering')
    const timer = window.setTimeout(() => {
      const root = rootRef.current
      if (!root) return
      moveTo(findSectionAnchor('bottom-right', { width: root.offsetWidth, height: root.offsetHeight }, root), { behaviour: 'route-change', arrivalState: 'looking' })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [hidden, location.pathname, moveTo, ready, resting])

  useEffect(() => {
    if (!ready) return
    const onSpin = event => {
      if (!event.target.closest('.spin-button') || open || hidden || resting) return
      interactionLockRef.current = Date.now() + 4500
      movementTweenRef.current?.kill()
      setVisualState('excited')
      setActiveBehaviour('product-spin')
      window.setTimeout(() => { setVisualState('celebrating'); setActiveBehaviour('product-win') }, 1400)
    }
    const onProductHover = event => {
      if (!event.target.closest('.product-card') || open || hidden || resting) return
      setVisualState('tailWagging')
      setActiveBehaviour('product-hover')
    }
    document.addEventListener('click', onSpin)
    document.addEventListener('pointerover', onProductHover)
    return () => { document.removeEventListener('click', onSpin); document.removeEventListener('pointerover', onProductHover) }
  }, [hidden, open, ready, resting])

  useEffect(() => {
    const audio = new Audio(hachiConfig.soundFile)
    const barkAudio = new Audio(hachiConfig.barkSoundFile)
    audio.preload = 'none'
    audio.volume = 0.18
    barkAudio.preload = 'auto'
    barkAudio.volume = 0.72
    barkAudio.load()
    audioRef.current = audio
    barkAudioRef.current = barkAudio
    return () => { audio.pause(); barkAudio.pause() }
  }, [])

  useEffect(() => subscribeSiteSound(enabled => {
    setSoundEnabled(enabled)
    if (!enabled) { stopSiteSound(audioRef.current); stopSiteSound(barkAudioRef.current) }
  }), [])

  useEffect(() => {
    if (!ready) return
    const onResize = () => {
      const nextMobile = window.innerWidth <= 700
      setMobileViewport(nextMobile)
      movementTweenRef.current?.kill()
      const root = rootRef.current
      if (!root) return
      const size = { width: root.offsetWidth || 132, height: root.offsetHeight || 142 }
      const next = clampPetPosition(positionRef.current, size)
      positionRef.current = next
      setPosition(next)
      gsap.set(root, { x: next.x, y: next.y })
      savePetPosition(next, size)
      if (!nextMobile) {
        const panelSize = panelRef.current
          ? { width: panelRef.current.offsetWidth, height: panelRef.current.offsetHeight }
          : getPanelSize()
        setPanelPosition(current => {
          const safe = clampPanelPosition(current, panelSize)
          savePanelPosition(safe, panelSize)
          return safe
        })
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [ready])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Escape') return
      if (open) closePanel()
      else if (petMenu || settingsOpen || prompt || welcome) {
        setPetMenu(false); setSettingsOpen(false); setHideConfirm(false); setPrompt(null); setWelcome(false); setVisualState('idle'); triggerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    if (!open) return
    window.requestAnimationFrame(() => panelRef.current?.querySelector('button, a, input')?.focus())
  }, [open, screen])

  useEffect(() => {
    if (!open || mobileViewport) return
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const size = { width: panel.offsetWidth, height: panel.offsetHeight }
      setPanelPosition(current => {
        const safe = clampPanelPosition(current, size)
        savePanelPosition(safe, size)
        return safe
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [mobileViewport, open])

  useEffect(() => {
    sessionStorage.setItem('furfoo_hachi_current_flow', screen)
  }, [screen])

  useEffect(() => {
    if (!open) return
    if (screen === 'bath-result' || screen === 'treat-result') setVisualState('success')
    else if (screen === 'urgent' || screen === 'unsupported') setVisualState('error')
    else setVisualState('open')
  }, [open, screen])

  useEffect(() => {
    if (!ready || open || resting || dragging) return
    let sleep
    const schedule = () => {
      window.clearTimeout(sleep)
      sleep = window.setTimeout(() => setVisualState('sleeping'), hachiConfig.sleepAfterMs)
    }
    const wake = () => { if (visualState === 'sleeping') setVisualState('idle'); schedule() }
    schedule()
    window.addEventListener('pointerdown', wake, { passive: true })
    window.addEventListener('keydown', wake)
    return () => { window.clearTimeout(sleep); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake) }
  }, [dragging, open, ready, resting, visualState])

  useEffect(() => {
    if (!ready || !hachiConfig.enableProactivePrompts || hachiConfig.enableSectionInteractions) return
    const observers = []
    hachiConfig.proactivePrompts.forEach(item => {
      const element = document.querySelector(item.selector)
      if (!element) return
      const observer = new IntersectionObserver(entries => {
        const entry = entries[0]
        const count = Number(sessionStorage.getItem(PROACTIVE_COUNT_KEY) || 0)
        const lastTime = Number(sessionStorage.getItem(PROACTIVE_TIME_KEY) || 0)
        const dismissed = sessionStorage.getItem(`furfoo_hachi_prompt_${item.id}`)
        const formActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
        if (entry.isIntersecting && !open && !prompt && !welcome && !dismissed && !formActive && !isCheckoutContext() && count < hachiConfig.maxProactivePromptsPerSession && Date.now() - lastTime >= hachiConfig.proactivePromptGapMs) {
          setPrompt(item)
          sessionStorage.setItem(PROACTIVE_COUNT_KEY, String(count + 1))
          sessionStorage.setItem(PROACTIVE_TIME_KEY, String(Date.now()))
          observer.disconnect()
        }
      }, { threshold: 0.42 })
      observer.observe(element)
      observers.push(observer)
    })
    return () => observers.forEach(observer => observer.disconnect())
  }, [isCheckoutContext, open, prompt, ready, welcome])

  useEffect(() => {
    if (!ready || !hachiConfig.enableExitPrompt) return
    const onExit = event => {
      if (event.clientY > 4 || window.innerWidth < 900 || open || welcome || prompt || sessionStorage.getItem(EXIT_KEY) || sessionStorage.getItem(USED_KEY) || isCheckoutContext()) return
      sessionStorage.setItem(EXIT_KEY, 'true')
      setPrompt({ id: 'exit', message: 'Leaving already? Hachi can help you find the right product before you go.', action: 'menu' })
    }
    document.addEventListener('mouseleave', onExit)
    return () => document.removeEventListener('mouseleave', onExit)
  }, [isCheckoutContext, open, prompt, ready, welcome])

  if (!hachiConfig.enabled || !ready) return null

  const playSound = () => {
    playSiteSound(audioRef.current)
  }
  const barkHachi = () => {
    movementTweenRef.current?.kill()
    if (resting) { setResting(false); sessionStorage.removeItem('furfoo_hachi_resting') }
    playSiteSound(barkAudioRef.current, { startAt: hachiConfig.barkStartOffset })
    setPetMenu(false); setSettingsOpen(false); setVisualState('startled'); setActiveBehaviour('user:bark'); sessionStorage.setItem(USED_KEY, 'true')
    window.setTimeout(() => { if (!open && !dragRef.current) setVisualState('idle') }, 1150)
  }
  const openPanel = (nextScreen = screen) => {
    interactionLockRef.current = Date.now() + 5000
    sessionStorage.setItem('furfoo_hachi_last_interaction', String(Date.now()))
    const root = rootRef.current
    if (root) {
      const current = { x: Number(gsap.getProperty(root, 'x')) || positionRef.current.x, y: Number(gsap.getProperty(root, 'y')) || positionRef.current.y }
      positionRef.current = current; setPosition(current)
    }
    movementTweenRef.current?.kill(); playSound(); setWelcome(false); setPrompt(null); setPetMenu(false); setSettingsOpen(false); setScreen(nextScreen); setOpen(true); setVisualState('sitting')
    localStorage.setItem(WELCOME_KEY, 'true'); sessionStorage.setItem(USED_KEY, 'true')
    trackHachiEvent('hachi_opened', { screen: nextScreen })
  }
  function closePanel() {
    setOpen(false); setVisualState('sitting'); trackHachiEvent('hachi_closed', { screen }); window.setTimeout(() => triggerRef.current?.focus(), 0)
  }
  const toggleSound = () => {
    const next = setSiteSoundEnabled(!soundEnabled); setSoundEnabled(next); trackHachiEvent('hachi_sound_toggled', { enabled: next, scope: 'site' })
  }
  const wakeHachi = () => { setResting(false); sessionStorage.removeItem('furfoo_hachi_resting'); setVisualState('waking'); setActiveBehaviour('user:waking'); window.setTimeout(() => setVisualState('idle'), 700) }
  const toggleHachiRest = () => {
    if (resting) { wakeHachi(); return }
    movementTweenRef.current?.kill(); setResting(true); setVisualState('sleeping'); setActiveBehaviour('user:resting'); sessionStorage.setItem('furfoo_hachi_resting', 'true')
  }
  const hideHachi = () => { movementTweenRef.current?.kill(); setHidden(true); setOpen(false); setPetMenu(false); setSettingsOpen(false); setHideConfirm(false); localStorage.setItem(HIDDEN_KEY, 'true'); setVisualState('hidden') }
  const restoreHachi = () => { setHidden(false); localStorage.removeItem(HIDDEN_KEY); setVisualState('entering'); setActiveBehaviour('user:restored') }
  const toggleReducedInteraction = () => {
    const next = !reducedInteraction; setReducedInteraction(next); localStorage.setItem(INTERACTION_KEY, next ? 'reduced' : 'full'); movementTweenRef.current?.kill(); setVisualState('sitting')
  }
  const resetPosition = () => {
    const root = rootRef.current
    if (!root) return
    const size = { width: root.offsetWidth || 132, height: root.offsetHeight || 142 }
    const next = clampPetPosition({ x: window.innerWidth - size.width - 22, y: window.innerHeight - size.height - 18 }, size)
    positionRef.current = next; setPosition(next); savePetPosition(next, size)
    gsap.to(root, { x: next.x, y: next.y, duration: systemReducedMotion ? 0 : .35, ease: 'sine.out' })
    setSettingsOpen(false); setVisualState('happy'); setActiveBehaviour('user:reset-position')
  }
  const handleCharacterClick = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    if (resting) { wakeHachi(); return }
    interactionLockRef.current = Date.now() + 3200
    sessionStorage.setItem('furfoo_hachi_last_interaction', String(Date.now()))
    const root = rootRef.current
    if (root) {
      const current = { x: Number(gsap.getProperty(root, 'x')) || positionRef.current.x, y: Number(gsap.getProperty(root, 'y')) || positionRef.current.y }
      positionRef.current = current; setPosition(current)
    }
    const expressions = ['tailWagging', 'headTilting', 'sniffing', 'startled', 'thinking']
    const next = expressions[expressionIndexRef.current % expressions.length]
    expressionIndexRef.current += 1
    movementTweenRef.current?.kill(); playSound(); setSettingsOpen(false); setPrompt(null); setWelcome(false); setVisualState(next); setActiveBehaviour(`direct:${next}`); sessionStorage.setItem(USED_KEY, 'true')
    window.setTimeout(() => { if (!open && !petMenu && !resting && !dragRef.current) setVisualState('idle') }, 1300)
  }
  const openPetMenu = () => {
    movementTweenRef.current?.kill(); setSettingsOpen(false); setPrompt(null); setWelcome(false); setPetMenu(true); setVisualState('headTilting'); setActiveBehaviour('direct:menu')
  }
  const handlePointerDown = event => {
    if (open || hidden) return
    const root = rootRef.current
    if (!root) return
    movementTweenRef.current?.kill()
    const current = { x: Number(gsap.getProperty(root, 'x')) || positionRef.current.x, y: Number(gsap.getProperty(root, 'y')) || positionRef.current.y }
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: current, moved: false, longPressed: false, target: event.currentTarget }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    window.clearTimeout(longPressRef.current)
    longPressRef.current = window.setTimeout(() => {
      if (!dragRef.current?.moved) {
        dragRef.current.longPressed = true
        suppressClickRef.current = true
        openPetMenu()
      }
    }, 650)
  }
  const handlePointerMove = event => {
    const drag = dragRef.current
    const root = rootRef.current
    if (!drag || drag.pointerId !== event.pointerId || !root) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < 7) return
    drag.moved = true
    window.clearTimeout(longPressRef.current)
    setDragging(true); setPetMenu(false); setWelcome(false); setPrompt(null)
    const size = { width: root.offsetWidth || 132, height: root.offsetHeight || 142 }
    const next = clampPetPosition({ x: drag.origin.x + dx, y: drag.origin.y + dy }, size)
    positionRef.current = next
    setFacing(dx >= 0 ? 'right' : 'left')
    setVisualState('happy'); setActiveBehaviour('direct:dragging')
    gsap.set(root, { x: next.x, y: next.y })
    if (event.cancelable) event.preventDefault()
  }
  const handlePointerEnd = event => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    window.clearTimeout(longPressRef.current)
    if (drag.moved) {
      const root = rootRef.current
      const size = { width: root?.offsetWidth || 132, height: root?.offsetHeight || 142 }
      setPosition(positionRef.current); savePetPosition(positionRef.current, size)
      suppressClickRef.current = true
      setVisualState('tailWagging'); setActiveBehaviour('direct:dropped')
      window.setTimeout(() => setVisualState(resting ? 'sleeping' : 'idle'), 1000)
    }
    dragRef.current = null
    setDragging(false)
    drag.target?.releasePointerCapture?.(event.pointerId)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerEnd)
    window.removeEventListener('pointercancel', handlePointerEnd)
  }
  const resetPanelPosition = () => {
    const panel = panelRef.current
    const size = panel ? { width: panel.offsetWidth, height: panel.offsetHeight } : getPanelSize()
    const next = defaultPanelPosition(size)
    setPanelPosition(next)
    savePanelPosition(next, size)
  }

  function handlePanelWheel(event) {
    const container = event.currentTarget
    if (container.scrollHeight <= container.clientHeight) return
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1
    event.preventDefault()
    event.stopPropagation()
    container.scrollTop += event.deltaY * unit
  }
  const handlePanelPointerDown = event => {
    if (mobileViewport || event.button !== 0) return
    const panel = panelRef.current
    if (!panel) return
    panelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: panelPosition,
      target: event.currentTarget,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setPanelDragging(true)
    window.addEventListener('pointermove', handlePanelPointerMove, { passive: false })
    window.addEventListener('pointerup', handlePanelPointerEnd)
    window.addEventListener('pointercancel', handlePanelPointerEnd)
    event.preventDefault()
  }
  const handlePanelPointerMove = event => {
    const drag = panelDragRef.current
    const panel = panelRef.current
    if (!drag || drag.pointerId !== event.pointerId || !panel) return
    const size = { width: panel.offsetWidth, height: panel.offsetHeight }
    const next = clampPanelPosition({
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    }, size)
    setPanelPosition(next)
    if (event.cancelable) event.preventDefault()
  }
  const handlePanelPointerEnd = event => {
    const drag = panelDragRef.current
    const panel = panelRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (panel) {
      const rect = panel.getBoundingClientRect()
      savePanelPosition({ x: rect.left, y: rect.top }, { width: panel.offsetWidth, height: panel.offsetHeight })
    }
    drag.target?.releasePointerCapture?.(event.pointerId)
    panelDragRef.current = null
    setPanelDragging(false)
    window.removeEventListener('pointermove', handlePanelPointerMove)
    window.removeEventListener('pointerup', handlePanelPointerEnd)
    window.removeEventListener('pointercancel', handlePanelPointerEnd)
  }
  const handlePanelMoveKey = event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') { resetPanelPosition(); return }
    const step = event.shiftKey ? 40 : 12
    const delta = {
      ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0],
    }[event.key]
    const panel = panelRef.current
    const size = panel ? { width: panel.offsetWidth, height: panel.offsetHeight } : getPanelSize()
    setPanelPosition(current => {
      const next = clampPanelPosition({ x: current.x + delta[0], y: current.y + delta[1] }, size)
      savePanelPosition(next, size)
      return next
    })
  }
  const dismissWelcome = () => { localStorage.setItem(WELCOME_KEY, 'true'); sessionStorage.setItem(EXIT_KEY, 'true'); setWelcome(false); trackHachiEvent('hachi_prompt_dismissed', { prompt: 'welcome' }) }
  const dismissPrompt = () => { if (prompt) sessionStorage.setItem(`furfoo_hachi_prompt_${prompt.id}`, 'true'); trackHachiEvent('hachi_prompt_dismissed', { prompt: prompt?.id }); setPrompt(null) }
  const navigateToProduct = product => {
    trackHachiEvent('hachi_product_clicked', { product: product.name })
    closePanel(); navigate(product.url)
  }
  const handleSubmit = async event => {
    event.preventDefault(); const message = input.trim(); if (!message) return
    setInput(''); setVisualState('thinking')
    await sendMessageToHachi(message)
    setVisualState('open'); setScreen(hasUrgentHealthTerms(message) ? 'urgent' : 'unsupported')
  }

  const bubbleVisible = !hidden && !open && (welcome || prompt || petMenu || settingsOpen)
  const bubbleOnRight = position.x < window.innerWidth / 2
  return <div ref={rootRef} className={`hachi-root is-${visualState}${open ? ' is-panel-open' : ''}${bubbleOnRight ? ' is-left-side' : ' is-right-side'}${facing === 'right' ? ' is-facing-right' : ' is-facing-left'}${resting ? ' is-resting' : ''}${hidden ? ' is-hidden' : ''}${heroActive ? ' is-hero-hidden' : ''}${dragging ? ' is-dragging' : ''}`} style={{ '--hachi-world-x': `${position.x}px`, '--hachi-world-y': `${position.y}px`, '--hachi-mobile-left': `${12 - position.x}px` }} data-hachi-root="true" data-hachi-state={visualState} data-hachi-section={currentSection} data-hachi-behaviour={activeBehaviour}>
    {hidden && <button type="button" className="hachi-restore-tab" onClick={restoreHachi} aria-label="Bring Hachi back"><PawPrint/><span>Bring Hachi back</span></button>}

    {bubbleVisible && <aside className={`hachi-popover${settingsOpen ? ' is-settings' : ''}`} aria-live="polite">
      {!settingsOpen && <button className="hachi-popover__dismiss" onClick={() => { setPetMenu(false); setSettingsOpen(false); setHideConfirm(false); welcome ? dismissWelcome() : dismissPrompt(); setVisualState('idle') }} aria-label="Dismiss Hachi message"><X/></button>}
      {settingsOpen ? <>
        <div className="hachi-settings-heading"><button type="button" className="direction-button direction-button--left hachi-settings-back" aria-label="Back to Hachi menu" onClick={() => { setHideConfirm(false); setSettingsOpen(false); setPetMenu(true); setVisualState(resting ? 'sleeping' : 'headTilting') }}><ArrowLeft/></button><strong>Hachi settings</strong></div>
        <p>Choose how playful Hachi should be.</p>
        {hideConfirm ? <div className="hachi-hide-confirm" role="group" aria-label="Confirm hiding Hachi">
          <strong>Hide Hachi for now?</strong>
          <div><button type="button" className="hachi-setting--hide" onClick={hideHachi}><EyeOff/>Hide Hachi</button><button type="button" onClick={() => setHideConfirm(false)}>Keep Hachi here</button></div>
        </div> : <div className="hachi-pet-choices hachi-pet-choices--settings">
          <button type="button" onClick={toggleSound}>{soundEnabled ? <VolumeX/> : <Volume2/>}{soundEnabled ? 'Mute page sounds' : 'Unmute page sounds'}</button>
          <button type="button" onClick={toggleReducedInteraction}><Gauge/>{reducedInteraction ? 'Resume movement' : 'Reduce movement'}</button>
          <button type="button" onClick={toggleHachiRest}>{resting ? <Sparkles/> : <Moon/>}{resting ? 'Wake Hachi' : 'Let Hachi rest'}</button>
          <button type="button" className="hachi-setting--hide" onClick={() => setHideConfirm(true)}><EyeOff/>Hide Hachi</button>
          <button type="button" className="hachi-setting--reset" onClick={resetPosition}><RotateCcw/>Reset position</button>
        </div>}
      </> : petMenu ? <>
        <strong>Need Hachi's help?</strong><p>I can sniff out the right pick for your furkid.</p>
        <div className="hachi-pet-choices hachi-pet-choices--main">
          <button className="hachi-pet-choice--primary" type="button" onClick={() => openPanel('menu')}><Sparkles/>Help Me Choose</button>
          <button type="button" onClick={() => openPanel('bath-intro')}><Stethoscope/>Herbal Bath</button>
          <button type="button" onClick={() => openPanel('treat-intro')}><Bone/>Treats</button>
          <button type="button" onClick={() => openPanel('adoption')}><HeartHandshake/>Adoption</button>
          <button type="button" onClick={() => openPanel('ask')}><MessageCircle/>Chat with Hachi</button>
        </div>
        <div className="hachi-menu-tools">
          <button type="button" className="hachi-menu-bark" onPointerDown={event => { if (event.button === 0) barkHachi() }} onClick={event => { if (event.detail === 0) barkHachi() }}><Volume2/>Bark</button>
          <button type="button" className="hachi-menu-settings" onClick={() => { setPetMenu(false); setHideConfirm(false); setSettingsOpen(true); setVisualState(resting ? 'sleeping' : 'sitting') }}><Settings/>Settings</button>
        </div>
      </> : <>
        <strong>{welcome ? (hachiConfig.welcome.cleanGreeting || hachiConfig.welcome.greeting) : prompt?.message}</strong>
        {welcome && <p>{hachiConfig.welcome.detail}</p>}
        <div><button type="button" onClick={() => { if (welcome) trackHachiEvent('hachi_welcome_clicked'); openPanel(prompt?.action || 'menu') }}>Ask Hachi</button><button type="button" onClick={welcome ? dismissWelcome : dismissPrompt}>Maybe Later</button></div>
      </>}
    </aside>}

    {open && createPortal(<section className={`hachi-panel${panelDragging ? ' is-moving' : ''}`} role="dialog" aria-modal="false" aria-labelledby="hachi-title" ref={panelRef} style={mobileViewport ? undefined : { left: `${panelPosition.x}px`, top: `${panelPosition.y}px`, right: 'auto', bottom: 'auto' }}>
      <header className="hachi-panel__header">
        {!mobileViewport && <button type="button" className="hachi-panel__drag-handle" aria-label="Move Hachi chat window" title="Drag to move · Arrow keys also work · Home resets" onPointerDown={handlePanelPointerDown} onKeyDown={handlePanelMoveKey} onDoubleClick={resetPanelPosition}><GripHorizontal aria-hidden="true"/></button>}
        <div className="hachi-header-avatar"><HachiRenderer state={visualState} failed={imageFailed} onError={() => setImageFailed(true)}/></div>
        <div><h2 id="hachi-title">{hachiConfig.assistantName}</h2><p>{hachiConfig.subtitle}</p><span><i/> {hachiConfig.statusLabel}</span></div>
        <div className="hachi-header-actions">
          <button type="button" onClick={toggleSound} aria-label={soundEnabled ? 'Turn page sounds off' : 'Turn page sounds on'}>{soundEnabled ? <Volume2/> : <VolumeX/>}</button>
          <button type="button" onClick={closePanel} aria-label="Close Hachi panel"><X/></button>
        </div>
      </header>
      <div className="hachi-panel__messages" aria-live="polite" onWheelCapture={handlePanelWheel}>
        {screen !== 'menu' && <button type="button" className="hachi-back" onClick={() => setScreen('menu')}><ArrowLeft/> Main menu</button>}
        <HachiContent {...{ screen, setScreen, bathAnswers, setBathAnswers, treatAnswers, setTreatAnswers, selectedFaq, setSelectedFaq, selectedPet, setSelectedPet, navigateToProduct }}/>
      </div>
      {hachiConfig.enableFreeTextInput && <form className="hachi-input" onSubmit={handleSubmit}><label className="sr-only" htmlFor="hachi-message-input">Ask Hachi something</label><input id="hachi-message-input" value={input} onChange={event => setInput(event.target.value)} placeholder="Ask Hachi something…"/><button type="submit" aria-label="Send message"><Send/></button></form>}
    </section>, document.body)}

    {!hidden && <button ref={triggerRef} type="button" className="hachi-trigger" onClick={() => open ? closePanel() : handleCharacterClick()} onDoubleClick={openPetMenu} onPointerDown={handlePointerDown} onContextMenu={event => { event.preventDefault(); movementTweenRef.current?.kill(); setPetMenu(false); setHideConfirm(false); setSettingsOpen(true); setVisualState(resting ? 'sleeping' : 'sitting') }} onMouseEnter={() => !open && !dragging && setVisualState(resting ? 'waking' : 'tailWagging')} onMouseLeave={() => !open && !dragging && setVisualState(resting ? 'sleeping' : 'idle')} aria-label={open ? 'Minimize Hachi assistant' : "Open Hachi, Furfoo’s website pet"} aria-expanded={open}>
      <span className="sr-only">Hachi is {visualState}</span>
      <HachiRenderer state={visualState} failed={imageFailed} onError={() => setImageFailed(true)}/>
      {visualState === 'thinking' && <span className="hachi-thinking-dots" aria-hidden="true"><i/><i/><i/></span>}
      {visualState === 'sleeping' && <span className="hachi-sleep-z" aria-hidden="true">Z z</span>}
    </button>}
    {!hidden && !open && <button type="button" className="hachi-menu-dot" onClick={openPetMenu} aria-label="Open Hachi menu"><MoreHorizontal/></button>}
    {hachiConfig.debug && !hidden && <output className="hachi-debug"><b>{visualState}</b><span>section: {currentSection}</span><span>x {Math.round(position.x)} · y {Math.round(position.y)}</span><span>target {Math.round(target.x)} · {Math.round(target.y)}</span><span>facing: {facing}</span><span>{activeBehaviour}</span><span>asset: {hachiConfig.assets[visualState] || 'fallback'}</span></output>}
  </div>
}
