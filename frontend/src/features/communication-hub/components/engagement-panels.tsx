import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { engagementApi } from '@/features/communication-hub/api/communication-hub.api'
import { Permission } from '@/features/authorization/permissions'
import { usePermissions } from '@/features/authorization/use-permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Draft = {
  body: string
  subject: string | null
  authorKind: 'ai'
  source: string
  channelReason: string
  modelUsed: boolean
  analysis?: { intent: string; confidence: string; evidence: string | null }
}

type Campaign = {
  id: string
  name: string
  status: string
  channel: string
  purpose: string
  approvalId?: string | null
  counts?: Array<{ status: string; total: number }>
}

type Analytics = {
  sent: number
  delivered: number
  read: number
  failed: number
  pending: number
  queued: number
  inbound: number
  outbound: number
  handoffs: number
  note: string
  responseTime: { sampleSize: number; medianMinutes: number | null; insufficient: boolean }
}

export function EngagementPanels() {
  const { hasPermission } = usePermissions()
  const canSend = hasPermission(Permission.CommunicationView)
  const canIntegrate = hasPermission(Permission.IntegrationManage)
  const [section, setSection] = useState<'compose' | 'preferences' | 'templates' | 'campaigns' | 'analytics'>('compose')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Customer engagement</CardTitle>
        <CardDescription>
          Outbound email, SMS, and WhatsApp stay on this hub. Marketing consent is never inferred from a stored address. Sent is provider acceptance, not delivery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['compose', 'preferences', 'templates', 'campaigns', 'analytics'] as const).map((item) => (
            <Button key={item} type="button" size="sm" variant={section === item ? 'default' : 'outline'} onClick={() => setSection(item)}>
              {item}
            </Button>
          ))}
        </div>
        {!canSend ? <p className="text-sm text-muted-foreground">Sending, campaigns, and preference changes require communication access for the whole tenant.</p> : null}
        {section === 'compose' ? <ComposePanel enabled={canSend} /> : null}
        {section === 'preferences' ? <PreferencePanel enabled={canSend} /> : null}
        {section === 'templates' ? <TemplatePanel enabled={canSend} /> : null}
        {section === 'campaigns' ? <CampaignPanel enabled={canSend} /> : null}
        {section === 'analytics' ? <AnalyticsPanel /> : null}
        {canIntegrate ? <WhatsAppPanel /> : null}
      </CardContent>
    </Card>
  )
}

function ComposePanel({ enabled }: { enabled: boolean }) {
  const [channel, setChannel] = useState('email')
  const [purpose, setPurpose] = useState('customer_requested')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [authorKind, setAuthorKind] = useState<'human' | 'ai'>('human')
  const [draftNote, setDraftNote] = useState('')
  const send = useMutation({
    mutationFn: () => engagementApi.send({
      channel,
      purpose,
      to,
      subject: channel === 'email' ? subject : undefined,
      body,
      authorKind,
      idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: (result: { status?: string }) => {
      toast.success(result.status === 'pending_approval' ? 'Waiting for approval. Nothing was sent.' : `Recorded as ${result.status}.`)
    },
    onError: () => toast.error('The message was not accepted.'),
  })
  const draft = useMutation({
    mutationFn: () => engagementApi.draft({ channel, purpose, excerpt: body }),
    onSuccess: (result: Draft) => {
      setBody(result.body)
      if (result.subject) setSubject(result.subject)
      setAuthorKind('ai')
      setDraftNote(`${result.channelReason} Source: ${result.source}. Model used: ${result.modelUsed ? 'yes' : 'no'}.`)
    },
    onError: () => toast.error('A draft could not be prepared.'),
  })

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger aria-label="Compose channel"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={purpose} onValueChange={setPurpose}>
          <SelectTrigger aria-label="Message purpose"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="transactional">Transactional</SelectItem>
            <SelectItem value="customer_requested">Customer requested</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
          </SelectContent>
        </Select>
        <Input aria-label="Recipient" value={to} onChange={(event) => setTo(event.target.value)} placeholder="Recipient" />
      </div>
      {channel === 'email' ? <Input aria-label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" /> : null}
      <textarea aria-label="Message body" className="min-h-28 w-full rounded-md border bg-background p-3 text-sm" value={body} onChange={(event) => setBody(event.target.value)} />
      {authorKind === 'ai' ? <Badge variant="secondary">AI draft</Badge> : null}
      {draftNote ? <p className="text-sm text-muted-foreground">{draftNote}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={!enabled || draft.isPending} onClick={() => draft.mutate()}>Draft with AI</Button>
        <Button type="button" disabled={!enabled || send.isPending} onClick={() => send.mutate()}>Submit for approval</Button>
      </div>
    </div>
  )
}

function PreferencePanel({ enabled }: { enabled: boolean }) {
  const [subjectId, setSubjectId] = useState('')
  const [marketingConsent, setMarketingConsent] = useState('unknown')
  const [evidence, setEvidence] = useState('')
  const [source, setSource] = useState('')
  const save = useMutation({
    mutationFn: () => engagementApi.savePreference({
      subjectType: 'lead',
      subjectId,
      emailStatus: 'unknown',
      smsStatus: 'unknown',
      whatsappStatus: 'unknown',
      marketingConsent,
      marketingConsentSource: source,
      marketingEvidence: evidence,
    }),
    onSuccess: () => toast.success('Preference saved from the evidence you entered.'),
    onError: () => toast.error('Preference was not saved. Marketing consent needs a source and evidence.'),
  })
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">A phone number or email address does not grant marketing consent.</p>
      <Input aria-label="Lead id" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} placeholder="Lead id" />
      <Select value={marketingConsent} onValueChange={setMarketingConsent}>
        <SelectTrigger aria-label="Marketing consent"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="unknown">Unknown</SelectItem>
          <SelectItem value="granted">Granted</SelectItem>
          <SelectItem value="denied">Denied</SelectItem>
          <SelectItem value="withdrawn">Withdrawn</SelectItem>
        </SelectContent>
      </Select>
      <Input aria-label="Consent source" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Consent source" />
      <Input aria-label="Consent evidence" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Consent evidence" />
      <Button type="button" disabled={!enabled || save.isPending} onClick={() => save.mutate()}>Save preference</Button>
    </div>
  )
}

function TemplatePanel({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient()
  const templates = useQuery({ queryKey: ['engagement-templates'], queryFn: () => engagementApi.templates() as Promise<Array<{ id: string; name: string; channel: string }>> })
  const [name, setName] = useState('')
  const [content, setContent] = useState('Hello {{firstName}}')
  const save = useMutation({
    mutationFn: () => engagementApi.saveTemplate({ name, channel: 'email', purpose: 'customer_requested', content }),
    onSuccess: () => {
      toast.success('Template saved.')
      void queryClient.invalidateQueries({ queryKey: ['engagement-templates'] })
    },
    onError: () => toast.error('Template was rejected. Use only firstName, lastName, companyName, or jobTitle.'),
  })
  return (
    <div className="space-y-3">
      {templates.isLoading ? <p className="text-sm text-muted-foreground">Loading templates…</p> : null}
      {templates.isError ? <p className="text-sm text-destructive">Templates could not be loaded.</p> : null}
      {(templates.data ?? []).length === 0 && !templates.isLoading ? <p className="text-sm text-muted-foreground">No templates yet.</p> : null}
      <Input aria-label="Template name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Template name" />
      <textarea aria-label="Template content" className="min-h-20 w-full rounded-md border p-3 text-sm" value={content} onChange={(event) => setContent(event.target.value)} />
      <Button type="button" disabled={!enabled || save.isPending} onClick={() => save.mutate()}>Save template</Button>
    </div>
  )
}

function CampaignPanel({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient()
  const campaigns = useQuery({ queryKey: ['engagement-campaigns'], queryFn: () => engagementApi.campaigns() as Promise<Campaign[]> })
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const start = useMutation({
    mutationFn: (id: string) => engagementApi.startCampaign(id),
    onSuccess: () => {
      toast.success('Campaign is waiting for approval or scheduled. No messages were marked delivered.')
      void queryClient.invalidateQueries({ queryKey: ['engagement-campaigns'] })
    },
    onError: () => toast.error('Campaign could not be started.'),
  })
  const cancel = useMutation({
    mutationFn: (id: string) => engagementApi.cancelCampaign(id),
    onSuccess: () => {
      setConfirmId(null)
      toast.success('Campaign cancelled.')
      void queryClient.invalidateQueries({ queryKey: ['engagement-campaigns'] })
    },
  })
  return (
    <div className="space-y-3">
      {campaigns.isLoading ? <p className="text-sm text-muted-foreground">Loading campaigns…</p> : null}
      {campaigns.isError ? <p className="text-sm text-destructive">Campaigns could not be loaded.</p> : null}
      {(campaigns.data ?? []).length === 0 && !campaigns.isLoading ? <p className="text-sm text-muted-foreground">No communication campaigns.</p> : null}
      {(campaigns.data ?? []).length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(campaigns.data ?? []).map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell>{campaign.name}</TableCell>
                <TableCell><Badge variant="outline">{campaign.status}{campaign.approvalId ? ' · approval' : ''}</Badge></TableCell>
                <TableCell>{campaign.channel}</TableCell>
                <TableCell className="space-x-2">
                  <Button type="button" size="sm" disabled={!enabled || start.isPending} onClick={() => start.mutate(campaign.id)}>Start</Button>
                  {confirmId === campaign.id ? (
                    <Button type="button" size="sm" variant="destructive" onClick={() => cancel.mutate(campaign.id)}>Confirm cancel</Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" disabled={!enabled} onClick={() => setConfirmId(campaign.id)}>Cancel</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  )
}

function AnalyticsPanel() {
  const analytics = useQuery({ queryKey: ['engagement-analytics'], queryFn: () => engagementApi.analytics() as Promise<Analytics> })
  if (analytics.isLoading) return <p className="text-sm text-muted-foreground">Loading communication analytics…</p>
  if (analytics.isError || !analytics.data) return <p className="text-sm text-destructive">Analytics could not be loaded.</p>
  const data = analytics.data
  return (
    <div className="space-y-2 text-sm">
      <p>{data.note}</p>
      <p>Sent {data.sent} · Delivered {data.delivered} · Read {data.read} · Failed {data.failed} · Pending {data.pending} · Queued {data.queued}</p>
      <p>Inbound {data.inbound} · Outbound {data.outbound} · Handoffs {data.handoffs}</p>
      <p>
        {data.responseTime.insufficient
          ? 'Response time is not shown because there are no reliable inbound and outbound timestamps to compare.'
          : `Median response ${data.responseTime.medianMinutes} minutes across ${data.responseTime.sampleSize} replies.`}
      </p>
    </div>
  )
}

function WhatsAppPanel() {
  const status = useQuery({ queryKey: ['engagement-whatsapp'], queryFn: () => engagementApi.whatsapp() as Promise<{ liveIntegration: string; status: string; configured: boolean }> })
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const save = useMutation({
    mutationFn: () => engagementApi.saveWhatsapp({ phoneNumberId, accessToken, appSecret, verifyToken }),
    onSuccess: () => toast.success('WhatsApp credentials stored. Live delivery stays unverified until a provider accepts a message.'),
    onError: () => toast.error('WhatsApp settings were not saved.'),
  })
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">WhatsApp Cloud API</p>
      {status.isLoading ? <p className="text-sm text-muted-foreground">Checking WhatsApp configuration…</p> : null}
      {status.data ? <p className="text-sm text-muted-foreground">Status {status.data.status}. Live integration: {status.data.liveIntegration}.</p> : null}
      <Input aria-label="WhatsApp phone number id" value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} placeholder="Phone number id" />
      <Input aria-label="WhatsApp access token" type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder="Access token" />
      <Input aria-label="WhatsApp app secret" type="password" value={appSecret} onChange={(event) => setAppSecret(event.target.value)} placeholder="App secret" />
      <Input aria-label="WhatsApp verify token" type="password" value={verifyToken} onChange={(event) => setVerifyToken(event.target.value)} placeholder="Verify token" />
      <Button type="button" variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>Save WhatsApp settings</Button>
    </div>
  )
}
