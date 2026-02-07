"use client"

import React, { useMemo, useState, useRef, useEffect } from "react"
import type { HistoryEntry } from "@/server/history"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, Calendar, X } from "lucide-react"
import { cn } from "@/lib/utils"

type FilterKey = "typ" | "produkt" | "variante" | "grund" | "datum"

type Filters = {
  typ: string[]
  produkt: string[]
  variante: string[]
  grund: string[]
  datum: string | null
}

function getEntryDateOnly(entry: HistoryEntry): string {
  if (!entry.createdAtRaw) return ""
  return entry.createdAtRaw.slice(0, 10)
}

function applyFilters(entries: HistoryEntry[], filters: Filters): HistoryEntry[] {
  return entries.filter((entry) => {
    if (
      filters.typ.length > 0 &&
      !filters.typ.includes(entry.type)
    )
      return false
    if (
      filters.produkt.length > 0 &&
      !filters.produkt.includes(entry.productName)
    )
      return false
    if (
      filters.variante.length > 0 &&
      !filters.variante.includes(entry.variantLabel)
    )
      return false
    if (
      filters.grund.length > 0 &&
      !filters.grund.includes(entry.reason ?? "")
    )
      return false
    if (filters.datum && getEntryDateOnly(entry) !== filters.datum)
      return false
    return true
  })
}

export function HistoryTable({ entries }: { entries: HistoryEntry[] }) {
  const [filters, setFilters] = useState<Filters>({
    typ: [],
    produkt: [],
    variante: [],
    grund: [],
    datum: null,
  })
  const [openDropdown, setOpenDropdown] = useState<FilterKey | null>(null)
  const [filterSearch, setFilterSearch] = useState<
    Record<Exclude<FilterKey, "datum">, string>
  >({
    typ: "",
    produkt: "",
    variante: "",
    grund: "",
  })
  const filterBarRef = useRef<HTMLDivElement>(null)

  const unique = useMemo(() => {
    const types = [...new Set(entries.map((e) => e.type))].sort()
    const products = [...new Set(entries.map((e) => e.productName).filter(Boolean))].sort()
    const variants = [...new Set(entries.map((e) => e.variantLabel).filter(Boolean))].sort()
    const reasons = [...new Set(entries.map((e) => e.reason ?? ""))].sort()
    return { types, products, variants, reasons }
  }, [entries])

  const filtered = useMemo(
    () => applyFilters(entries, filters),
    [entries, filters]
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterBarRef.current &&
        !filterBarRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleFilter = (key: keyof Filters, value: string) => {
    if (key === "datum") return
    const arr = filters[key] as string[]
    const next = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value]
    setFilters((f) => ({ ...f, [key]: next }))
  }

  const setDateFilter = (value: string) => {
    setFilters((f) => ({ ...f, datum: value || null }))
  }

  const clearDateFilter = () => {
    setFilters((f) => ({ ...f, datum: null }))
    setOpenDropdown(null)
  }

  const resetAllFilters = () => {
    setFilters({
      typ: [],
      produkt: [],
      variante: [],
      grund: [],
      datum: null,
    })
    setFilterSearch({
      typ: "",
      produkt: "",
      variante: "",
      grund: "",
    })
    setOpenDropdown(null)
  }

  const pillLabel = (key: FilterKey, count: number) => {
    const labels: Record<FilterKey, string> = {
      typ: "Typ",
      produkt: "Produkt",
      variante: "Variante",
      grund: "Grund",
      datum: "Datum",
    }
    const base = labels[key]
    return count > 0 ? `${base} (${count})` : base
  }

  const renderDropdown = (key: FilterKey) => {
    if (openDropdown !== key) return null

    const baseClass =
      "absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-background p-2 shadow-md overflow-hidden"

    if (key === "datum") {
      return (
        <div className={cn(baseClass, "w-auto")}>
          <div className="flex flex-col gap-2">
            <input
              type="date"
              value={filters.datum ?? ""}
              onChange={(e) => setDateFilter(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              aria-label="Datum auswählen"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={clearDateFilter}
            >
              <X className="h-3 w-3" />
              Zurücksetzen
            </Button>
          </div>
        </div>
      )
    }

    const items =
      key === "typ"
        ? unique.types
        : key === "produkt"
          ? unique.products
          : key === "variante"
            ? unique.variants
            : unique.reasons

    const filterArr = filters[key] as string[]
    const searchValue = filterSearch[key]
    const filteredItems = items.filter((item) => {
      if (!searchValue.trim()) return true
      const label = item === "" ? "(leer)" : item
      return label.toLowerCase().includes(searchValue.toLowerCase())
    })

    return (
      <div className={cn(baseClass, "w-64")}>
        <div className="px-2 pb-2">
          <Input
            type="search"
            placeholder="Filter durchsuchen…"
            value={searchValue}
            onChange={(e) =>
              setFilterSearch((s) => ({ ...s, [key]: e.target.value }))
            }
            className="h-8"
          />
        </div>
        <ScrollArea className="h-60">
          <div className="flex flex-col gap-1 py-1">
            {filteredItems.length === 0 ? (
              <span className="text-muted-foreground text-sm px-2">
                Keine Einträge
              </span>
            ) : (
              filteredItems.map((item) => {
                const label = item === "" ? "(leer)" : item
                return (
                  <label
                    key={`${key}-${String(item)}`}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={filterArr.includes(item)}
                      onCheckedChange={() => toggleFilter(key, item)}
                    />
                    <span className="truncate">{label}</span>
                  </label>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  const filterCount = (key: FilterKey) =>
    key === "datum"
      ? (filters.datum ? 1 : 0)
      : (filters[key] as string[]).length

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-wrap items-center gap-2" ref={filterBarRef}>
        {(
          ["typ", "produkt", "variante", "grund", "datum"] as const
        ).map((key) => (
          <div key={key} className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "gap-1 rounded-full font-normal",
                filterCount(key) > 0 && "border-primary bg-primary/10"
              )}
              onClick={() =>
                setOpenDropdown((open) => (open === key ? null : key))
              }
              aria-expanded={openDropdown === key}
              aria-haspopup="true"
            >
              {key === "datum" ? (
                <Calendar className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    openDropdown === key && "rotate-180"
                  )}
                />
              )}
              {pillLabel(key, filterCount(key))}
            </Button>
            {renderDropdown(key)}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={resetAllFilters}
        >
          Filter zurücksetzen
        </Button>
      </div>

      <div className="rounded-md border overflow-auto max-h-[40vh] min-h-[40vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Typ</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead>Variante (z. B. Farbe)</TableHead>
              <TableHead className="text-right">Anzahl</TableHead>
              <TableHead>Grund</TableHead>
              <TableHead>Ersteller</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  {entries.length === 0
                    ? "Noch keine Einträge (Output oder Adjustment anlegen)."
                    : "Keine Einträge passen zum Filter."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Badge
                      variant={entry.type === "Output" ? "default" : "secondary"}
                      className={cn(
                        entry.type === "Output" &&
                          "bg-cyan-900 hover:bg-cyan-950",
                        entry.type === "Adjustment" &&
                          "bg-red-900/80 hover:bg-red-900"
                      )}
                    >
                      {entry.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entry.createdAt || "–"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {entry.productName || "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.variantLabel || "–"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.quantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {entry.reason ?? "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.createdBy ?? "–"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
