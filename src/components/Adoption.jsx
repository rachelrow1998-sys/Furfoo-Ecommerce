import { ArrowRight, ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import SectionReveal from './SectionReveal'

const pets = [
  { name: 'Maple', species: 'Cat', gender: 'Female', age: 'About 2 years', location: 'Petaling Jaya', status: 'Available', image: '/media/adoption/maple.png', personality: 'Gentle, observant, and happiest beside a sunny window.', introduction: 'Maple is a calm ginger tabby who takes a little time to say hello, then quietly chooses a favourite person to follow from room to room. She enjoys window watching, soft blankets, and slow evening company.', vaccinated: 'Yes — core vaccinations up to date', neutered: 'Yes', home: 'A calm indoor home; suitable for first-time cat guardians', contact: 'FURFOO Community Foster · Aina' },
  { name: 'Milo', species: 'Dog', gender: 'Male', age: 'About 1 year', location: 'Subang Jaya', status: 'Available', image: '/media/adoption/milo.png', personality: 'Curious, affectionate, and always ready for a gentle walk.', introduction: 'Milo is an easy-going young dog with a thoughtful side. He loves sniffing around the garden, learning simple cues, and settling close to his people after a walk.', vaccinated: 'Yes — core vaccinations up to date', neutered: 'Scheduled before adoption', home: 'A patient home with daily walks and a secure outdoor area', contact: 'Independent Rescuer · Wei Lin' },
  { name: 'Luna', species: 'Cat', gender: 'Female', age: 'About 10 months', location: 'Kuala Lumpur', status: 'Adoption Pending', image: '/media/adoption/luna.png', personality: 'Soft-natured, playful, and fond of quiet hiding spots.', introduction: 'Luna is a sweet calico who blossoms with gentle attention. Once comfortable, she brings out her toys, curls up nearby, and answers conversation with tiny chirps.', vaccinated: 'Yes — core vaccinations up to date', neutered: 'Yes', home: 'Indoor-only home with a calm routine; older children preferred', contact: 'FURFOO Community Foster · Mira' },
  { name: 'Bumi', species: 'Dog', gender: 'Male', age: 'About 7 years', location: 'Shah Alam', status: 'Available', image: '/media/adoption/bumi.png', personality: 'Steady, friendly, and deeply appreciative of good company.', introduction: 'Bumi is a dignified senior with excellent house manners and a wonderfully warm smile. He asks for very little: a comfortable bed, relaxed walks, and someone to share the day with.', vaccinated: 'Yes — core vaccinations up to date', neutered: 'Yes', home: 'A low-key home with minimal stairs and plenty of companionship', contact: 'Independent Rescuer · Farah' },
]

export default function Adoption() {
  const trackRef = useRef(null)
  const closeRef = useRef(null)
  const previousFocus = useRef(null)
  const [selectedPet, setSelectedPet] = useState(null)

  const move = direction => {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector('.adoption-card')
    track.scrollBy({ left: direction * ((card?.offsetWidth || 320) + 18), behavior: 'smooth' })
  }

  const openPet = pet => {
    previousFocus.current = document.activeElement
    setSelectedPet(pet)
  }

  const closePet = () => setSelectedPet(null)

  useEffect(() => {
    if (!selectedPet) return
    const onKeyDown = event => { if (event.key === 'Escape') closePet() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
      previousFocus.current?.focus?.()
    }
  }, [selectedPet])

  return <section className="adoption section" id="adoption">
    <div className="section-shell">
      <div className="adoption-head">
        <div>
          <span className="eyebrow">FURFOO COMMUNITY · ADOPTION</span>
          <SectionReveal>FURFOO Finds<br/><em>a Home.</em></SectionReveal>
        </div>
        <div className="adoption-intro">
          <SectionReveal as="p">Meet a few special cats and dogs currently looking for a loving home.</SectionReveal>
        </div>
      </div>

      <div className="adoption-carousel">
        <button className="direction-button direction-button--left adoption-side-control is-previous" type="button" onClick={() => move(-1)} aria-label="Previous pets"><ChevronLeft/></button>
        <div className="adoption-track" ref={trackRef} aria-label="Pets looking for homes">
          {pets.map(pet => <article className="adoption-card" key={pet.name}>
            <div className="adoption-photo">
              <img src={pet.image} alt={`${pet.name}, a ${pet.gender.toLowerCase()} ${pet.species.toLowerCase()} looking for a home`} loading="lazy"/>
              <span className={`adoption-status ${pet.status === 'Adoption Pending' ? 'is-pending' : ''}`}>{pet.status}</span>
            </div>
            <div className="adoption-card-copy">
              <div className="adoption-name-row"><h3>{pet.name}</h3><span>{pet.species}</span></div>
              <div className="adoption-facts"><span>{pet.gender}</span><span>{pet.age}</span></div>
              <div className="adoption-location"><MapPin/> {pet.location}</div>
              <p>{pet.personality}</p>
              <button type="button" className="adoption-meet" onClick={() => openPet(pet)}>Meet Me <ArrowRight/></button>
            </div>
          </article>)}
        </div>
        <button className="direction-button direction-button--right adoption-side-control is-next" type="button" onClick={() => move(1)} aria-label="Next pets"><ChevronRight/></button>
      </div>
      <p className="adoption-note">Every enquiry is handled personally with the animal's wellbeing first.</p>
    </div>

    {selectedPet && <div className="adoption-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closePet() }}>
      <div className="adoption-modal" role="dialog" aria-modal="true" aria-labelledby="adoption-modal-title">
        <button ref={closeRef} type="button" className="adoption-modal-close" onClick={closePet} aria-label="Close pet details"><X/></button>
        <div className="adoption-modal-photo"><img src={selectedPet.image} alt={selectedPet.name}/></div>
        <div className="adoption-modal-copy">
          <span className={`adoption-status ${selectedPet.status === 'Adoption Pending' ? 'is-pending' : ''}`}>{selectedPet.status}</span>
          <h3 id="adoption-modal-title">Meet {selectedPet.name}</h3>
          <p className="adoption-modal-intro">{selectedPet.introduction}</p>
          <dl>
            <div><dt>Vaccination</dt><dd>{selectedPet.vaccinated}</dd></div>
            <div><dt>Neutering</dt><dd>{selectedPet.neutered}</dd></div>
            <div><dt>Suitable home</dt><dd>{selectedPet.home}</dd></div>
            <div><dt>Contact</dt><dd>{selectedPet.contact}</dd></div>
          </dl>
          <a className="button button--primary adoption-enquire" href={`mailto:hello@furfoo.com?subject=${encodeURIComponent(`Adoption enquiry for ${selectedPet.name}`)}`}>Adoption enquiry <ArrowRight/></a>
        </div>
      </div>
    </div>}
  </section>
}
