import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Permission } from '@/features/authorization/permissions'
import { usePermissions } from '@/features/authorization/use-permissions'
import { customerFacingApi, type CustomerAiSettings } from '@/features/customer-facing/api/customer-facing.api'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useKnowledgebases } from '@/features/knowledgebases/hooks/use-knowledgebases'

const empty: CustomerAiSettings = {
  publicKey: '',
  enabled: false,
  displayName: 'Assistant',
  welcomeMessage: '',
  instructions: '',
  leadCaptureEnabled: false,
  handoffNotificationsEnabled: true,
  knowledgeBaseId: null,
  companyId: null,
  collectName: true,
  collectEmail: true,
  collectPhone: false,
  accent: 'slate',
}

export function CustomerAiSettingsPage() {
  const { hasPermission } = usePermissions()
  const allowed = hasPermission(Permission.BrandManage)
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['customer-ai-settings'], queryFn: () => customerFacingApi.settings(), enabled: allowed })
  const companies = useCompanies()
  const knowledgebases = useKnowledgebases()
  const [form, setForm] = useState<CustomerAiSettings>(empty)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings.data) setForm(settings.data)
  }, [settings.data])

  const save = useMutation({
    mutationFn: () => customerFacingApi.updateSettings({
      ...form,
      companyId: form.companyId || null,
      knowledgeBaseId: form.knowledgeBaseId || null,
    }),
    onSuccess: async (next) => {
      setForm(next)
      setSaved(true)
      await queryClient.invalidateQueries({ queryKey: ['customer-ai-settings'] })
    },
  })

  if (!allowed) {
    return (
      <div className="space-y-4">
        <PageHeader title="Customer AI" description="Public chat settings for this business." />
        <p className="text-sm text-muted-foreground">You do not have permission to change customer AI settings.</p>
      </div>
    )
  }

  const publicPath = form.publicKey ? `${window.location.origin}/chat/${form.publicKey}` : ''

  return (
    <div className="space-y-6">
      <PageHeader title="Customer AI" description="Control the public assistant. API keys and internal prompts stay on the server." />
      {settings.isLoading ? <p className="text-sm text-muted-foreground">Loading settings…</p> : null}
      {settings.isError ? <p role="alert" className="text-sm text-destructive">Customer AI settings could not be loaded.</p> : null}
      {settings.data ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Public chat</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted-foreground">Public page: {publicPath}</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enable customer-facing AI</label>
            <label className="grid gap-1 text-sm">Display name<Input aria-label="Display name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
            <label className="grid gap-1 text-sm">Welcome message<Input aria-label="Welcome message" value={form.welcomeMessage} onChange={(event) => setForm({ ...form, welcomeMessage: event.target.value })} /></label>
            <label className="grid gap-1 text-sm">Business instructions for the assistant<Input aria-label="Business instructions" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
            <label className="grid gap-1 text-sm">
              Appearance
              <select aria-label="Appearance" className="h-9 rounded-lg border bg-background px-3" value={form.accent} onChange={(event) => setForm({ ...form, accent: event.target.value as CustomerAiSettings['accent'] })}>
                <option value="slate">Slate</option>
                <option value="blue">Blue</option>
                <option value="emerald">Emerald</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Knowledge base
              <select aria-label="Knowledge base" className="h-9 rounded-lg border bg-background px-3" value={form.knowledgeBaseId ?? ''} onChange={(event) => setForm({ ...form, knowledgeBaseId: event.target.value || null })}>
                <option value="">No knowledge base</option>
                {(knowledgebases.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Company for new leads
              <select aria-label="Company" className="h-9 rounded-lg border bg-background px-3" value={form.companyId ?? ''} onChange={(event) => setForm({ ...form, companyId: event.target.value || null })}>
                <option value="">No company</option>
                {(companies.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.leadCaptureEnabled} onChange={(event) => setForm({ ...form, leadCaptureEnabled: event.target.checked })} /> Create leads when a visitor gives a name and email or phone</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.handoffNotificationsEnabled} onChange={(event) => setForm({ ...form, handoffNotificationsEnabled: event.target.checked })} /> Notify through active handoff workflows</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.collectName} onChange={(event) => setForm({ ...form, collectName: event.target.checked })} /> Ask for a name</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.collectEmail} onChange={(event) => setForm({ ...form, collectEmail: event.target.checked })} /> Ask for an email</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.collectPhone} onChange={(event) => setForm({ ...form, collectPhone: event.target.checked })} /> Ask for a phone number</label>
            <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save settings'}</Button>
            {saved ? <p className="text-sm text-muted-foreground">Settings saved.</p> : null}
            {save.isError ? <p role="alert" className="text-sm text-destructive">Settings were not saved.</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
