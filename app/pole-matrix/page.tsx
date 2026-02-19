"use client"

import { useEffect, useRef, useState } from "react"
import {
  getPoleMatrixData,
  type MatrixRow,
} from "@/server/pole-matrix"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, RefreshCw, SlidersHorizontal, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

type Filter = "all" | "kein_magnet" | "magnet"
type ProductType = "RAW" | "INTERMEDIATE" | "FINAL"
type ConfigItem = { name: string; selected: boolean }

const COLOR_STYLES: Record<string, { bg: string; header: string }> = {
  Schwarz:    { bg: "bg-gray-100/80",    header: "bg-gray-200"   },
  "Weiß":     { bg: "bg-slate-50/80",    header: "bg-slate-100"  },
  Pink:       { bg: "bg-pink-50/80",     header: "bg-pink-200"   },
  "Türkis":   { bg: "bg-teal-50/80",     header: "bg-teal-200"   },
  Rot:        { bg: "bg-red-50/80",      header: "bg-red-200"    },
  Neongelb:   { bg: "bg-yellow-50/80",   header: "bg-yellow-200" },
  "Neongrün": { bg: "bg-lime-50/80",     header: "bg-lime-200"   },
}

const TYPE_BADGE: Record<ProductType, string> = {
  RAW:          "bg-slate-100 text-slate-600 border-slate-200",
  INTERMEDIATE: "bg-amber-50 text-amber-700 border-amber-200",
  FINAL:        "bg-emerald-50 text-emerald-700 border-emerald-200",
}

const TYPE_LABEL: Record<ProductType, string> = {
  RAW:          "Rohstoff",
  INTERMEDIATE: "Halb",
  FINAL:        "Fertig",
}

const STORAGE_KEY = "pole-matrix-config"

function loadFromStorage(): ConfigItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(config: ConfigItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function mergeConfig(rows: MatrixRow[], stored: ConfigItem[]): ConfigItem[] {
  const storedMap = new Map(stored.map((c, i) => [c.name, { selected: c.selected, order: i }]))
  const currentNames = rows.map((r) => r.label)

  const merged = currentNames.map((name) => ({
    name,
    selected: storedMap.get(name)?.selected ?? true,
    order:    storedMap.get(name)?.order    ?? Infinity,
  }))

  merged.sort((a, b) => {
    if (a.order !== Infinity && b.order !== Infinity) return a.order - b.order
    if (a.order === Infinity && b.order === Infinity) return a.name.localeCompare(b.name)
    return a.order === Infinity ? 1 : -1
  })

  return merged.map(({ name, selected }) => ({ name, selected }))
}

export default function PoleMatrixPage() {
  const [allRows, setAllRows]         = useState<MatrixRow[]>([])
  const [colors, setColors]           = useState<string[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<Filter>("all")
  const [config, setConfig]           = useState<ConfigItem[]>([])
  const [modalOpen, setModalOpen]     = useState(false)
  const [modalConfig, setModalConfig] = useState<ConfigItem[]>([])
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const dragItemIdx = useRef<number | null>(null)

  async function load() {
    setLoading(true)
    const result = await getPoleMatrixData()
    if (result.success && result.data) {
      setAllRows(result.data.rows)
      setColors(result.data.colors)
      setConfig(mergeConfig(result.data.rows, loadFromStorage()))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const typeMap = new Map<string, ProductType>(allRows.map((r) => [r.label, r.type]))

  const displayedRows = config
    .filter((c) => c.selected)
    .map((c) => allRows.find((r) => r.label === c.name))
    .filter((r): r is MatrixRow => r !== undefined)
    .filter((row) => {
      if (filter === "kein_magnet") return row.category !== "magnet"
      if (filter === "magnet")      return row.category !== "kein_magnet"
      return true
    })

  // ── Modal ──────────────────────────────────────────────────────────────
  function openModal() {
    setModalConfig([...config])
    setModalOpen(true)
  }

  function applyModal() {
    setConfig(modalConfig)
    saveToStorage(modalConfig)
    setModalOpen(false)
  }

  // ── Drag-and-Drop (cross-type, flat list) ──────────────────────────────
  function handleDragStart(e: React.DragEvent, idx: number) {
    dragItemIdx.current = idx
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragItemIdx.current !== idx) setDragOverIdx(idx)
  }

  function handleDrop(targetIdx: number) {
    const sourceIdx = dragItemIdx.current
    if (sourceIdx === null || sourceIdx === targetIdx) {
      resetDrag()
      return
    }
    const next = [...modalConfig]
    const [dragged] = next.splice(sourceIdx, 1)
    next.splice(targetIdx, 0, dragged)
    setModalConfig(next)
    resetDrag()
  }

  function resetDrag() {
    dragItemIdx.current = null
    setDragOverIdx(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <section className="flex w-full flex-col gap-4 p-4 md:p-8">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Pole-Matrix</CardTitle>
              <CardDescription>Bestandsübersicht nach Produkt und Farbe</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={filter === "all"         ? "default" : "outline"} onClick={() => setFilter("all")}>Alle</Button>
              <Button size="sm" variant={filter === "kein_magnet" ? "default" : "outline"} onClick={() => setFilter("kein_magnet")}>Kein Magnet</Button>
              <Button size="sm" variant={filter === "magnet"      ? "default" : "outline"} onClick={() => setFilter("magnet")}>Magnet</Button>
              <Button size="sm" variant="outline" onClick={openModal} disabled={loading}>
                <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                Inhalte
              </Button>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                <RefreshCw className={cn("mr-1 h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 z-20 bg-card px-4 py-3 text-left font-semibold whitespace-nowrap min-w-[180px] border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      Produkt
                    </th>
                    {colors.map((color) => {
                      const style = COLOR_STYLES[color]
                      return (
                        <th
                          key={color}
                          className={cn(
                            "px-4 py-3 text-center font-semibold whitespace-nowrap min-w-[90px] border-x border-white/60",
                            style?.header
                          )}
                        >
                          {color}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row) => (
                    <tr key={row.label} className="group border-b last:border-b-0">
                      <td className="sticky left-0 z-20 bg-card group-hover:bg-muted px-4 py-3 font-medium whitespace-nowrap border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                        {row.label}
                      </td>
                      {colors.map((color) => {
                        const cell  = row.cells[color]
                        const style = COLOR_STYLES[color]
                        return (
                          <td
                            key={color}
                            className={cn(
                              "px-4 py-3 text-center tabular-nums border-x border-white/60",
                              style?.bg
                            )}
                          >
                            {cell != null ? (
                              <div>
                                <span className={cn(cell.needsReorder && "text-red-600 font-semibold")}>
                                  {cell.quantity}
                                </span>
                                {cell.minimumStock > 0 && (
                                  <div className="text-[11px] text-muted-foreground leading-tight">
                                    Min: {cell.minimumStock}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {displayedRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={colors.length + 1}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Keine Produkte für den gewählten Filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Inhalte-Modal ───────────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Inhalte konfigurieren</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-1">
            Produkte ein-/ausblenden und per Drag & Drop in der gewünschten Reihenfolge anordnen.
          </p>

          <div className="flex-1 overflow-y-auto min-h-0 rounded-md border divide-y">
            {modalConfig.map((item, idx) => {
              const type = typeMap.get(item.name) as ProductType | undefined
              const isDropTarget = dragOverIdx === idx && dragItemIdx.current !== idx

              return (
                <div
                  key={item.name}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={resetDrag}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors select-none",
                    item.selected ? "bg-background" : "bg-muted/30",
                    isDropTarget && "border-t-2 border-primary bg-primary/5"
                  )}
                >
                  <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-muted-foreground/50 hover:text-muted-foreground" />
                  <Checkbox
                    id={`cfg-${idx}`}
                    checked={item.selected}
                    onCheckedChange={(checked) => {
                      const next = [...modalConfig]
                      next[idx] = { ...next[idx], selected: !!checked }
                      setModalConfig(next)
                    }}
                  />
                  <label
                    htmlFor={`cfg-${idx}`}
                    className={cn(
                      "flex-1 cursor-pointer text-sm leading-none",
                      !item.selected && "text-muted-foreground"
                    )}
                  >
                    {item.name}
                  </label>
                  {type && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium flex-shrink-0",
                        TYPE_BADGE[type]
                      )}
                    >
                      {TYPE_LABEL[type]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={applyModal}>Übernehmen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
