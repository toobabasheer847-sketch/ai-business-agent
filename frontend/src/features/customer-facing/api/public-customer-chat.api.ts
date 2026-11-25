import { API_URL } from '@/lib/constants/app'

export type PublicChatConfig = {
  displayName: string
  welcomeMessage: string
  enabled: boolean
  collectName: boolean
  collectEmail: boolean
  collectPhone: boolean
  accent: 'slate' | 'blue' | 'emerald'
  disclosure: string
  privacyNotice: string
  starters: string[]
}

export type PublicChatMessage = {
  id: string
  role: 'human' | 'ai'
  content: string
  createdAt: string
}

export type PublicChatHistory = {
  messages: PublicChatMessage[]
  status: string
  handoff: boolean
  handoffNote: string | null
  disclosure: string
}

export class CustomerChatError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'CustomerChatError'
    this.status = status
  }
}

async function readError(response: Response, fallback: string) {
  let message = fallback
  try {
    const body = (await response.json()) as { message?: string | string[] }
    if (typeof body.message === 'string' && body.message.trim()) message = body.message
    else if (Array.isArray(body.message) && body.message[0]) message = body.message.join(' ')
  } catch {
    message = response.statusText || fallback
  }
  return new CustomerChatError(response.status, message)
}

function url(publicKey: string, suffix = '') {
  return `${API_URL}/public/customer-chat/${encodeURIComponent(publicKey)}${suffix}`
}

async function request<T>(publicKey: string, suffix: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url(publicKey, suffix), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) throw await readError(response, 'The chat could not complete that request.')
  return (await response.json()) as T
}

export function getPublicCustomerChat(publicKey: string) {
  return request<PublicChatConfig>(publicKey, '')
}

export function startPublicCustomerChat(publicKey: string) {
  return request<PublicChatConfig & { sessionToken: string; expiresInDays: number }>(publicKey, '/sessions', { method: 'POST' })
}

export function getPublicCustomerHistory(publicKey: string, sessionToken: string) {
  return request<PublicChatHistory>(publicKey, '/messages', { headers: { 'x-customer-session': sessionToken } })
}

export function sendPublicCustomerMessage(publicKey: string, sessionToken: string, content: string) {
  return request<{ reply: string; handoff: boolean; handoffNote: string | null; unanswered: boolean }>(publicKey, '/messages', {
    method: 'POST',
    headers: { 'x-customer-session': sessionToken },
    body: JSON.stringify({ content }),
  })
}

export function submitPublicCustomerDetails(
  publicKey: string,
  sessionToken: string,
  details: { name?: string; email?: string; phone?: string; requirements?: string },
) {
  return request<{ saved: boolean; leadCreated: boolean; leadLinked: boolean; reason: string }>(publicKey, '/details', {
    method: 'POST',
    headers: { 'x-customer-session': sessionToken },
    body: JSON.stringify(details),
  })
}

export function requestPublicCustomerHandoff(publicKey: string, sessionToken: string) {
  return request<{ handoff: boolean; handoffNote: string }>(publicKey, '/handoff', {
    method: 'POST',
    headers: { 'x-customer-session': sessionToken },
  })
}

export function endPublicCustomerChat(publicKey: string, sessionToken: string) {
  return request<{ ended: boolean }>(publicKey, '/end', {
    method: 'POST',
    headers: { 'x-customer-session': sessionToken },
  })
}
