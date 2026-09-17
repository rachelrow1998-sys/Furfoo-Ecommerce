/**
 * Editorial copy for the shop.
 *
 * Product facts — name, price, photo, stock — come from the Furfoo POS through
 * the storefront API. Nothing in this file overrides them. What lives here is
 * the writing and styling the POS has no field for: the tasting note, the
 * benefit tags, the ingredient line and the accent colour of the card.
 *
 * Matching, in order: `sku` against the POS SKU, then `id` against the product
 * slug, then the product name. Fill in `sku` for a reliable match — it is the
 * only field that survives a product being renamed in the POS.
 *
 * A POS product with no entry here still appears in the shop, using the POS
 * name, category and photo. An entry here with no POS product does not: the POS
 * decides what is for sale. The whole list is also the fallback catalogue when
 * VITE_STOREFRONT_API is unset, which is what keeps the site buildable and
 * previewable on its own.
 */

export const productEditorial = [
  {
    id: 'salmon-chicken-strips',
    sku: '',
    name: 'Salmon & Chicken Strips',
    price: 18.9,
    image: '/media/products/salmon-chicken.jpg',
    category: 'Natural Treats',
    note: 'A savoury, protein-rich chew for coat glow and daily energy.',
    tags: ['Coat glow', 'Daily energy'],
    ingredients: 'Salmon, chicken',
    color: '#f3b35b',
  },
  {
    id: 'duck-salmon-roll',
    sku: '',
    name: 'Duck & Salmon Skin Roll',
    price: 19.9,
    image: '/media/products/duck-salmon-roll.jpg',
    category: 'Functional Treats',
    note: 'A satisfying double-texture roll that supports skin and dental care.',
    tags: ['Omega-3', 'Dental care'],
    ingredients: 'Duck, salmon skin',
    color: '#b86883',
  },
  {
    id: 'greens-biscuits',
    sku: '',
    name: 'Chicken & Greens Biscuits',
    price: 16.9,
    image: '/media/products/greens-biscuits.jpg',
    category: 'Functional Treats',
    note: 'A fibre-forward crunchy bite for happy tummies and clean teeth.',
    tags: ['Digestion', 'Dental care'],
    ingredients: 'Chicken, greens, goat milk',
    color: '#9a9c62',
  },
  {
    id: 'wholesome-crispy-bites',
    sku: '',
    name: 'Wholesome Crispy Bites',
    price: 17.9,
    image: '/media/products/wholesome-chips.jpg',
    category: 'Natural Treats',
    note: 'Four colourful flavours, air-dried into a light rewarding crunch.',
    tags: ['Variety pack', 'Training'],
    ingredients: 'Meat, pumpkin, blueberry, vegetables',
    color: '#e8ae1a',
  },
]

/**
 * The catalogue used when the storefront API is not configured or not
 * answering. Same shape as a live product, with stock left unknown rather than
 * invented: a fallback card can be browsed, and the bag falls back to WhatsApp.
 */
export const products = productEditorial.map(entry => ({
  ...entry,
  priceCents: Math.round(entry.price * 100),
  stockQty: null,
  inStock: true,
  lowStock: false,
  live: false,
}))
