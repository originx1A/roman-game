import { handleCart } from '../lib/cartHandler.ts'

export default function cart(req: Request): Promise<Response> {
  return handleCart(req)
}
