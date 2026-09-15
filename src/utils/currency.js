const ringgit = new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Single place the whole site turns a number into money. */
export const formatPrice = value => `RM ${ringgit.format(value)}`
