import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type KnowledgebasesFiltersProps = {
  search: string
  onSearchChange: (value: string) => void
  onReset: () => void
}

export function KnowledgebasesFilters({
  search,
  onSearchChange,
  onReset,
}: KnowledgebasesFiltersProps) {
  const hasFilters = Boolean(search)

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name…"
          className="pl-9"
          aria-label="Search knowledgebases"
        />
      </div>

      {hasFilters && (
        <Button type="button" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  )
}
