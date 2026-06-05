/**
 * lib/swr-fetcher.ts
 *
 * Shared SWR fetcher used across all dashboard pages.
 *
 * Why this exists:
 *  The naive `(url) => fetch(url).then(r => r.json())` does NOT throw on
 *  non-2xx responses. When an API returns {error:"..."} with status 401/403/504
 *  SWR stores that object as `data`, bypassing the `= []` default, and any
 *  `.map()` call crashes with "is not a function".
 *
 * This fetcher:
 *  1. Throws on non-OK status → SWR sets data=undefined → default [] applies
 *  2. Normalises wrapped responses: { data: [...] } → [...] for backward compat
 *  3. Always returns an Array when the caller expects one (use arrayFetcher)
 */

export class ApiError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message ?? `API error ${status}`)
    this.status = status
  }
}

/** Generic fetcher — throws ApiError on non-2xx */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new ApiError(res.status)
  const data = await res.json()
  return data as T
}

/**
 * Array fetcher — always returns T[].
 * Use as the SWR fetcher when the endpoint returns an array.
 * Handles:
 *   [ {...}, {...} ]        → returned as-is
 *   { data: [{...}] }      → unwrapped to data
 *   anything else / error  → []
 */
export async function arrayFetcher<T = unknown>(url: string): Promise<T[]> {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new ApiError(res.status)
  const data = await res.json()
  if (Array.isArray(data)) return data as T[]
  if (data && Array.isArray(data.data)) return data.data as T[]
  return []
}
