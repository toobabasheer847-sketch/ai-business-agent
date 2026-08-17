import { useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Phone, Search, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAvailablePhoneNumbers,
  useBuyPhoneNumber,
} from '@/features/phone-numbers/hooks/use-phone-numbers'
import type {
  AvailableNumberType,
  AvailablePhoneNumber,
  AvailablePhoneNumbersQuery,
} from '@/features/phone-numbers/types/phone-number.types'

type BuyNumberDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BuyNumberDialog({ open, onOpenChange }: BuyNumberDialogProps) {
  const [countryCode, setCountryCode] = useState('US')
  const [locality, setLocality] = useState('')
  const [areaCode, setAreaCode] = useState('')
  const [type, setType] = useState<AvailableNumberType>('local')
  const [submittedQuery, setSubmittedQuery] = useState<AvailablePhoneNumbersQuery | null>(null)
  const [selected, setSelected] = useState<AvailablePhoneNumber | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const availableQuery = useAvailablePhoneNumbers(submittedQuery, open && Boolean(submittedQuery))
  const buyMutation = useBuyPhoneNumber()

  const canSearch = Boolean(locality.trim() || areaCode.trim())

  const results = availableQuery.data ?? []

  const locationLabel = useMemo(() => {
    const parts = [
      selected?.locality,
      selected?.region,
      selected?.isoCountry,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : '—'
  }, [selected])

  const selectedDescription = useMemo(() => {
    if (!selected) return '—'
    const caps = [
      selected.capabilities.voice ? 'Voice' : null,
      selected.capabilities.sms ? 'SMS' : null,
      selected.capabilities.mms ? 'MMS' : null,
    ].filter(Boolean)
    const bits = [
      selected.friendlyName,
      locationLabel !== '—' ? locationLabel : null,
      selected.type === 'tollFree' ? 'Toll-free number' : 'Local number',
      caps.length > 0 ? `Supports ${caps.join(', ')}` : null,
      selected.addressRequirements && selected.addressRequirements !== 'none'
        ? `Address requirement: ${selected.addressRequirements}`
        : null,
    ].filter(Boolean)
    return bits.length > 0 ? bits.join(' · ') : 'Twilio inventory number available for purchase.'
  }, [selected, locationLabel])

  function resetSearchState() {
    setSubmittedQuery(null)
    setSelected(null)
    setConfirmOpen(false)
  }

  function openNumberDetails(item: AvailablePhoneNumber) {
    // Selection alone never purchases — only opens the confirmation/details modal.
    setSelected(item)
    setConfirmOpen(true)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetSearchState()
      setLocality('')
      setAreaCode('')
      setType('local')
      setCountryCode('US')
    }
    onOpenChange(next)
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    if (!canSearch) {
      toast.error('Enter a city and/or area code to search')
      return
    }

    const parsedArea = areaCode.trim() ? Number(areaCode.trim()) : undefined
    if (areaCode.trim() && (Number.isNaN(parsedArea) || parsedArea! < 100 || parsedArea! > 999)) {
      toast.error('Area code must be a 3-digit number')
      return
    }

    setSelected(null)
    setSubmittedQuery({
      countryCode: countryCode.trim().toUpperCase() || 'US',
      locality: locality.trim() || undefined,
      areaCode: parsedArea,
      type,
      limit: 20,
    })
  }

  async function handleBuy() {
    if (!selected) return

    try {
      const bought = await buyMutation.mutateAsync({
        phoneNumber: selected.phoneNumber,
        label: selected.friendlyName || selected.locality || undefined,
        locality: selected.locality || locality.trim() || undefined,
        region: selected.region || undefined,
        countryCode: selected.isoCountry || countryCode,
      })
      toast.success(`Purchased ${bought.phoneNumber}`)
      setConfirmOpen(false)
      handleOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-4 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="size-4" />
              Buy a Number
            </DialogTitle>
            <DialogDescription>
              Search Twilio inventory by city or area code, select a number, then confirm purchase.
              Tenant billing credentials come from Phone Numbers Twilio configuration or environment variables.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <form
              onSubmit={handleSearch}
              className="grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-2"
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="buy-locality">City / locality</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="buy-locality"
                    className="pl-9"
                    placeholder="e.g. San Francisco"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buy-area">Area code</Label>
                <Input
                  id="buy-area"
                  placeholder="415"
                  inputMode="numeric"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                />
              </div>

              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States (US)</SelectItem>
                    <SelectItem value="CA">Canada (CA)</SelectItem>
                    <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Number type</Label>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as AvailableNumberType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="tollFree">Toll-free</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end sm:col-span-2">
                <Button type="submit" className="w-full sm:w-auto" disabled={!canSearch}>
                  <Search className="size-4" />
                  Search available numbers
                </Button>
              </div>
            </form>

            {!submittedQuery && (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                Enter a city and/or area code, then search for available Twilio numbers.
              </div>
            )}

            {submittedQuery && availableQuery.isFetching && (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-5/6" />
              </div>
            )}

            {submittedQuery && availableQuery.isError && (
              <Alert variant="destructive">
                <AlertTitle>Could not load available numbers</AlertTitle>
                <AlertDescription>{getErrorMessage(availableQuery.error)}</AlertDescription>
              </Alert>
            )}

            {submittedQuery && availableQuery.isSuccess && results.length === 0 && (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center">
                <Phone className="mx-auto mb-2 size-5 text-muted-foreground" />
                <p className="text-sm font-medium">No numbers found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another city, area code, or number type.
                </p>
              </div>
            )}

            {submittedQuery && availableQuery.isSuccess && results.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {results.length} available number{results.length === 1 ? '' : 's'}
                </p>
                <ul className="space-y-2">
                  {results.map((item, index) => {
                    const isSelected = selected?.phoneNumber === item.phoneNumber
                    return (
                      <motion.li
                        key={item.phoneNumber}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.24) }}
                      >
                        <button
                          type="button"
                          onClick={() => openNumberDetails(item)}
                          className={cn(
                            'flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'hover:bg-muted/50',
                          )}
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium tracking-tight">{item.phoneNumber}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[item.locality, item.region, item.isoCountry]
                                .filter(Boolean)
                                .join(', ') || 'Location unavailable'}
                            </p>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {item.capabilities.voice && <Badge variant="outline">Voice</Badge>}
                              {item.capabilities.sms && <Badge variant="outline">SMS</Badge>}
                              {item.capabilities.mms && <Badge variant="outline">MMS</Badge>}
                              <Badge variant="secondary" className="capitalize">
                                {item.type === 'tollFree' ? 'Toll-free' : 'Local'}
                              </Badge>
                            </div>
                          </div>
                          <Badge variant={isSelected ? 'default' : 'outline'}>View details</Badge>
                        </button>
                      </motion.li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="border-t p-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open && !buyMutation.isPending) {
            // Keep selected highlight in the list; clear only when buy dialog closes fully.
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Number details</DialogTitle>
            <DialogDescription>
              Review this number carefully. Purchase runs only if you click Buy Number below.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Phone number</span>
                <span className="font-medium">{selected.phoneNumber}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span>Available</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Description</span>
                <span className="text-right sm:text-left">{selectedDescription}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Location</span>
                <span className="text-right">{locationLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Provider</span>
                <span>Twilio</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">
                  {selected.type === 'tollFree' ? 'Toll-free' : 'Local'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Capabilities</span>
                <span>
                  {[
                    selected.capabilities.voice ? 'Voice' : null,
                    selected.capabilities.sms ? 'SMS' : null,
                    selected.capabilities.mms ? 'MMS' : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={buyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleBuy()}
              disabled={!selected || buyMutation.isPending}
            >
              {buyMutation.isPending ? 'Purchasing…' : 'Buy Number'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
