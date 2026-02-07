"use client"

import { useEffect, useState } from "react"
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
import { Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

type Filter = "all" | "kein_magnet" | "magnet"

/** Blasse Hintergrundfarben + Header-Farben pro Spalte */
const COLOR_STYLES: Record<string, { bg: string; header: string }> = {
  Schwarz:  { bg: "bg-gray-100/80",    header: "bg-gray-200" },
  "Weiß":   { bg: "bg-slate-50/80",    header: "bg-slate-100" },
  Pink:     { bg: "bg-pink-50/80",     header: "bg-pink-200" },
  "Türkis": { bg: "bg-teal-50/80",     header: "bg-teal-200" },
  Rot:      { bg: "bg-red-50/80",      header: "bg-red-200" },
  Neongelb: { bg: "bg-yellow-50/80",   header: "bg-yellow-200" },
  "Neongrün": { bg: "bg-lime-50/80",   header: "bg-lime-200" },
}

export default function PoleMatrixPage() {
  const [rows, setRows] = useState<MatrixRow[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("all")

  async function load() {
    setLoading(true)
    const result = await getPoleMatrixData()
    if (result.success && result.data) {
      setRows(result.data.rows)
      setColors(result.data.colors)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filteredRows = rows.filter((row) => {
    if (filter === "all") return true
    // "Nur Kein Magnet" → hide magnet, show kein_magnet + other
    if (filter === "kein_magnet") return row.category !== "magnet"
    // "Nur Magnet" → hide kein_magnet, show magnet + other
    if (filter === "magnet") return row.category !== "kein_magnet"
    return true
  })

  return (
    <section className="flex w-full flex-col gap-4 p-4 md:p-8">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Pole-Matrix</CardTitle>
              <CardDescription>
                Bestandsübersicht nach Produkt und Farbe
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                Alle
              </Button>
              <Button
                size="sm"
                variant={filter === "kein_magnet" ? "default" : "outline"}
                onClick={() => setFilter("kein_magnet")}
              >
                Kein Magnet
              </Button>
              <Button
                size="sm"
                variant={filter === "magnet" ? "default" : "outline"}
                onClick={() => setFilter("magnet")}
              >
                Magnet
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw
                  className={cn("mr-1 h-3.5 w-3.5", loading && "animate-spin")}
                />
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
                  {filteredRows.map((row) => (
                    <tr
                      key={row.label}
                      className="group border-b last:border-b-0"
                    >
                      <td className="sticky left-0 z-20 bg-card group-hover:bg-muted px-4 py-3 font-medium whitespace-nowrap border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                        {row.label}
                      </td>
                      {colors.map((color) => {
                        const cell = row.cells[color]
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
                                <span
                                  className={cn(
                                    cell.needsReorder && "text-red-600 font-semibold"
                                  )}
                                >
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
                  {filteredRows.length === 0 && (
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
    </section>
  )
}
