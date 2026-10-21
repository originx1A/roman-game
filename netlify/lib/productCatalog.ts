/**
 * Bundled copy of config/products.json so the Netlify function does not
 * read the file from disk. The cart test keeps the two copies equal.
 * unitAmount stays null and stripePriceId stays empty until tokenomics.
 * US buyers use the usd list. Everyone else uses the cad list.
 * Adaptive Pricing is on in addition to that choice.
 */
export const PRODUCT_CATALOG: Catalog = {
  adaptivePricing: true,
  lists: {
    usd: {
      currency: 'usd',
      buyers: 'US',
      products: [
        { sku: 'coins_500', stripePriceId: '', unitAmount: null },
        { sku: 'coins_1400', stripePriceId: '', unitAmount: null },
        { sku: 'coins_3200', stripePriceId: '', unitAmount: null },
        { sku: 'starter_bundle', stripePriceId: '', unitAmount: null, once: true },
        { sku: 'adventurer', stripePriceId: '', unitAmount: null },
        { sku: 'stable', stripePriceId: '', unitAmount: null },
      ],
    },
    cad: {
      currency: 'cad',
      buyers: 'everyone_else',
      products: [
        { sku: 'coins_500', stripePriceId: '', unitAmount: null },
        { sku: 'coins_1400', stripePriceId: '', unitAmount: null },
        { sku: 'coins_3200', stripePriceId: '', unitAmount: null },
        { sku: 'starter_bundle', stripePriceId: '', unitAmount: null, once: true },
        { sku: 'adventurer', stripePriceId: '', unitAmount: null },
        { sku: 'stable', stripePriceId: '', unitAmount: null },
      ],
    },
  },
}

export type Catalog = {
  adaptivePricing: boolean
  lists: {
    usd: PriceList
    cad: PriceList
  }
}

export type PriceList = {
  currency: 'usd' | 'cad'
  buyers: string
  products: CatalogProduct[]
}

export type CatalogProduct = {
  sku: string
  stripePriceId: string
  unitAmount: number | null
  once?: boolean
}
