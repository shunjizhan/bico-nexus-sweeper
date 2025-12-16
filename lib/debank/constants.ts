export const DEBANK_API_BASE = process.env.NEXT_PUBLIC_DEBANK_API_BASE || 'https://pro-openapi.debank.com/v1'

export const DEBANK_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'AccessKey': process.env.NEXT_PUBLIC_DEBANK_ACCESS_KEY || '',
}
