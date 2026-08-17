import { products as storefrontProducts } from '../../data/products'

const bathProducts = [
  { id: 'itch-off', name: 'Itch-Off', category: 'bath', petType: ['dog', 'cat'], concerns: ['itchy', 'red-spots'], image: '/media/products/all-in-one.jpg', url: '/shop', available: true, description: 'A gentle herbal bath blend for irritated or sensitive skin.', suitedFor: 'Itchy, irritated, or sensitive skin' },
  { id: 'shiny-coat', name: 'Shiny Coat', category: 'bath', petType: ['dog', 'cat'], concerns: ['dry-coat', 'maintenance'], image: '/media/products/all-in-one.jpg', url: '/shop', available: false, description: 'A coat-care herbal blend for a dry coat and regular maintenance.', suitedFor: 'Dry coats, shedding, and coat upkeep' },
  { id: 'stink-go', name: 'Stink-Go', category: 'bath', petType: ['dog', 'cat'], concerns: ['odour'], image: '/media/products/all-in-one.jpg', url: '/shop', available: true, description: 'A fresh herbal bath blend for pets with a strong body odour.', suitedFor: 'Freshening up between adventures' },
  { id: 'bug-away', name: 'Bug-Away', category: 'bath', petType: ['dog'], concerns: ['bugs'], image: '/media/products/all-in-one.jpg', url: '/shop', available: true, description: 'A botanical outdoor-care bath blend.', suitedFor: 'Outdoor-loving dogs' },
  { id: 'zenpet', name: 'ZenPet', category: 'bath', petType: ['dog', 'cat'], concerns: ['anxiety'], image: '/media/products/all-in-one.jpg', url: '/shop', available: true, description: 'A softly aromatic herbal bath ritual for quiet wind-down time.', suitedFor: 'A calm, comforting bath routine' },
  { id: 'balanced-bloom-plus', name: 'Balanced Bloom Plus', category: 'bath', petType: ['dog', 'cat'], concerns: ['anxiety', 'bugs', 'odour'], image: '/media/products/all-in-one.jpg', url: '/shop', available: true, description: 'A portable herbal sachet for travel and outdoor routines.', suitedFor: 'Travel, outdoor time, or a fresh-smelling companion' },
]

// Product facts come from the storefront catalogue. The fields below add only
// deterministic recommendation metadata; no invented sales or popularity data.
const treatKnowledge = {
  'salmon-chicken-strips': { petType: ['dog', 'cat'], flavours: ['salmon', 'chicken'], texture: ['chewy'], goals: ['coat', 'energy', 'everyday'], allergens: ['salmon', 'chicken'], url: '/products/salmon-chicken-strips', available: true },
  'duck-salmon-roll': { petType: ['dog'], flavours: ['duck', 'salmon'], texture: ['chewy', 'crunchy'], goals: ['coat', 'dental'], allergens: ['duck', 'salmon'], url: '/products/duck-salmon-roll', available: true },
  'greens-biscuits': { petType: ['dog'], flavours: ['chicken'], texture: ['crunchy'], goals: ['digestion', 'dental'], allergens: ['chicken', 'milk'], url: '/products/greens-biscuits', available: true },
  'wholesome-crispy-bites': { petType: ['dog', 'cat'], flavours: ['beef', 'lamb', 'ostrich'], texture: ['light', 'crunchy'], goals: ['training', 'everyday'], allergens: ['beef', 'lamb', 'ostrich'], url: '/products/wholesome-crispy-bites', available: true },
}

const treatProducts = storefrontProducts.map(product => ({
  ...product,
  ...treatKnowledge[product.id],
  category: 'treat',
  description: product.note,
  suitedFor: product.tags.join(', '),
}))

export const hachiProducts = [...bathProducts, ...treatProducts]

const labels = {
  crunchy: 'crunchy texture', chewy: 'chewy texture', light: 'light and crispy texture',
  chicken: 'chicken preference', duck: 'duck preference', salmon: 'salmon preference',
  beef: 'beef preference', lamb: 'lamb preference', ostrich: 'ostrich preference',
  coat: 'coat support', energy: 'daily energy', dental: 'dental care',
  digestion: 'digestion', training: 'training rewards', everyday: 'everyday treating',
}

export function recommendTreat({ petType, texture, flavour, avoid, goal }) {
  const eligible = treatProducts.filter(product => {
    if (!product.available || !product.petType.includes(petType)) return false
    if (avoid && !['none', 'other'].includes(avoid) && product.allergens.includes(avoid)) return false
    return true
  })

  return eligible.map(product => {
    let score = 35 // verified pet-type fit + currently listed as available
    const reasons = [`Suitable for ${petType === 'cat' ? 'cats' : 'dogs'}`, 'Currently listed as available']
    const evidence = []

    if (texture === 'unsure' || !texture) score += 12
    else if (product.texture.includes(texture)) { score += 25; reasons.push(`Matches the ${labels[texture]} preference`); evidence.push(labels[texture]) }

    if (flavour === 'surprise' || !flavour) score += 10
    else if (product.flavours.includes(flavour)) { score += 20; reasons.push(`Contains the preferred ${flavour} flavour`); evidence.push(labels[flavour]) }

    if (!goal || goal === 'unsure') score += 10
    else if (product.goals.includes(goal)) { score += 20; reasons.push(`Product catalogue tags support ${labels[goal]}`); evidence.push(labels[goal]) }

    const caution = avoid === 'other'
      ? 'You selected another ingredient to avoid. Please verify the full ingredient label with Furfoo before ordering.'
      : null

    return {
      ...product,
      recommendation: {
        score,
        matchPercent: Math.min(99, Math.max(45, score)),
        reasons: reasons.slice(0, 5),
        evidence,
        caution,
        dataUsed: ['pet type', 'catalogue availability', 'texture', 'flavour', 'goal', 'ingredients', 'current price'],
      },
    }
  }).sort((a, b) => b.recommendation.score - a.recommendation.score || a.price - b.price).slice(0, 3)
}

export function recommendBath(concern) {
  const primary = bathProducts.find(product => product.concerns.includes(concern))
  const portable = ['anxiety', 'bugs', 'odour'].includes(concern)
    ? bathProducts.find(product => product.id === 'balanced-bloom-plus')
    : null
  return [primary, portable].filter(Boolean).filter((product, index, list) => list.findIndex(item => item.id === product.id) === index)
}
