import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  endPublicCustomerChat,
  getPublicCustomerChat,
  getPublicCustomerHistory,
  requestPublicCustomerHandoff,
  sendPublicCustomerMessage,
  startPublicCustomerChat,
  submitPublicCustomerDetails,
  type PublicChatConfig,
  type PublicChatMessage,
} from '@/features/customer-facing/api/public-customer-chat.api'

const accents = {
  slate: 'bg-slate-900',
  blue: 'bg-blue-700',
  emerald: 'bg-emerald-700',
}

function sessionKey(publicKey: string) {
  return `customer-chat:${publicKey}`
}

export function PublicCustomerChatPage() {
  const { publicKey = '' } = useParams()
  const [config, setConfig] = useState<PublicChatConfig | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [messages, setMessages] = useState<PublicChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [handoffNote, setHandoffNote] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)
  const [details, setDetails] = useState({ name: '', email: '', phone: '', requirements: '' })
  const [detailNote, setDetailNote] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    getPublicCustomerChat(publicKey)
      .then((view) => {
        if (cancelled) return
        setConfig(view)
        const saved = window.sessionStorage.getItem(sessionKey(publicKey)) ?? ''
        if (!saved) return
        setToken(saved)
        setConsent(true)
        return getPublicCustomerHistory(publicKey, saved).then((history) => {
          if (cancelled) return
          setMessages(history.messages)
          setHandoffNote(history.handoffNote)
          setClosed(history.status === 'resolved')
        }).catch(() => {
          window.sessionStorage.removeItem(sessionKey(publicKey))
          if (!cancelled) setToken('')
        })
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setLoadError(reason instanceof Error ? reason.message : 'This chat is not available.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [publicKey])

  async function start() {
    setBusy(true)
    setError('')
    try {
      const started = await startPublicCustomerChat(publicKey)
      window.sessionStorage.setItem(sessionKey(publicKey), started.sessionToken)
      setToken(started.sessionToken)
      setMessages([])
      setClosed(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The chat could not start.')
    } finally {
      setBusy(false)
    }
  }

  async function send(content = draft) {
    const text = content.trim()
    if (!text || !token) return
    setBusy(true)
    setError('')
    setDraft('')
    const localId = `local-${Date.now()}`
    setMessages((current) => [...current, { id: localId, role: 'human', content: text, createdAt: new Date().toISOString() }])
    try {
      const response = await sendPublicCustomerMessage(publicKey, token, text)
      setMessages((current) => [
        ...current,
        { id: `${localId}-reply`, role: 'ai', content: response.reply, createdAt: new Date().toISOString() },
      ])
      setHandoffNote(response.handoffNote)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The message was not sent.')
    } finally {
      setBusy(false)
    }
  }

  async function saveDetails() {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const response = await submitPublicCustomerDetails(publicKey, token, {
        name: details.name || undefined,
        email: details.email || undefined,
        phone: details.phone || undefined,
        requirements: details.requirements || undefined,
      })
      setDetailNote(response.reason)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Those details were not saved.')
    } finally {
      setBusy(false)
    }
  }

  async function handoff() {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const response = await requestPublicCustomerHandoff(publicKey, token)
      setHandoffNote(response.handoffNote)
      const history = await getPublicCustomerHistory(publicKey, token)
      setMessages(history.messages)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'A person could not be requested.')
    } finally {
      setBusy(false)
    }
  }

  async function end() {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await endPublicCustomerChat(publicKey, token)
      window.sessionStorage.removeItem(sessionKey(publicKey))
      setClosed(true)
      setToken('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The conversation could not be ended.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 text-sm text-muted-foreground">Loading chat…</main>
  }

  if (loadError || !config) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-3 px-4">
        <h1 className="text-xl font-semibold">Chat unavailable</h1>
        <p className="text-sm text-muted-foreground">{loadError || 'This chat is not available.'}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col bg-background text-foreground">
      <header className={`${accents[config.accent] ?? accents.slate} px-4 py-5 text-white`}>
        <p className="text-xs uppercase tracking-wide text-white/80">AI assistant</p>
        <h1 className="text-xl font-semibold">{config.displayName}</h1>
        <p className="mt-2 text-sm text-white/90">{config.disclosure}</p>
      </header>
      <section className="flex flex-1 flex-col gap-4 px-4 py-5" aria-live="polite">
        <p className="text-sm">{config.welcomeMessage}</p>
        <p className="text-xs text-muted-foreground">{config.privacyNotice}</p>
        {!config.enabled ? <p className="text-sm">This chat is not available.</p> : null}
        {config.enabled && !token && !closed ? (
          <div className="space-y-3 rounded-lg border p-4">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>I understand I am talking with an AI assistant and that this business stores the conversation.</span>
            </label>
            <Button type="button" disabled={!consent || busy} onClick={() => void start()}>
              {busy ? 'Starting…' : 'Start conversation'}
            </Button>
          </div>
        ) : null}
        {token ? (
          <>
            <div className="flex flex-wrap gap-2">
              {config.starters.map((starter) => (
                <Button key={starter} type="button" variant="outline" size="sm" disabled={busy || closed} onClick={() => void send(starter)}>
                  {starter}
                </Button>
              ))}
            </div>
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={message.role === 'human' ? 'ml-8 rounded-lg bg-muted px-3 py-2 text-sm' : 'mr-8 rounded-lg border px-3 py-2 text-sm'}>
                  <p className="mb-1 text-xs text-muted-foreground">{message.role === 'human' ? 'You' : config.displayName}</p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
              {busy ? <p className="text-sm text-muted-foreground">Working…</p> : null}
            </div>
            {handoffNote ? <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">{handoffNote}</p> : null}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <label className="sr-only" htmlFor="customer-message">Message</label>
              <Input id="customer-message" value={draft} maxLength={2000} disabled={busy || closed} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message" />
              <Button type="submit" disabled={busy || closed || !draft.trim()}>Send</Button>
            </form>
            <div className="grid gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Contact details are optional</p>
              {config.collectName ? <Input aria-label="Name" value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} placeholder="Name" /> : null}
              {config.collectEmail ? <Input aria-label="Email" value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} placeholder="Email" /> : null}
              {config.collectPhone ? <Input aria-label="Phone" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} placeholder="Phone" /> : null}
              <Input aria-label="Requirements" value={details.requirements} onChange={(event) => setDetails({ ...details, requirements: event.target.value })} placeholder="What do you need?" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void saveDetails()}>Save details</Button>
                <Button type="button" variant="outline" disabled={busy || closed} onClick={() => void handoff()}>Talk to a person</Button>
                <Button type="button" variant="ghost" disabled={busy || closed} onClick={() => void end()}>End conversation</Button>
              </div>
              {detailNote ? <p className="text-xs text-muted-foreground">{detailNote}</p> : null}
            </div>
          </>
        ) : null}
        {closed ? <p className="text-sm">This conversation is closed.</p> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </section>
    </main>
  )
}
