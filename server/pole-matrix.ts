"use server"

import { getInventory, type InventoryItem } from "@/server/inventory"

const COLORS = [
  "Schwarz",
  "Weiß",
  "Pink",
  "Türkis",
  "Rot",
  "Neongelb",
  "Neongrün",
] as const

/** Map DB color aliases to canonical column names */
const COLOR_ALIASES: Record<string, string> = {
  gelb: "Neongelb",
  grün: "Neongrün",
}

const COLORS_LOWER = COLORS.map((c) => c.toLowerCase())

type MatrixRowDef = {
  label: string
  /** Match any of these product names (case-insensitive). Multiple = aggregation (e.g. Shiny+Matt) */
  productNames: string[]
  category: "magnet" | "kein_magnet" | "other"
}

const ROW_DEFINITIONS: MatrixRowDef[] = [
  { label: "Nupsi | Kein Magnet", productNames: ["Nupsi | Kein Magnet"], category: "kein_magnet" },
  { label: "Nupsi | Magnet", productNames: ["Nupsi | Magnet"], category: "magnet" },
  { label: "Griff | Kein Magnet", productNames: ["Griff | Kein Magnet"], category: "kein_magnet" },
  { label: "Griff | Magnet", productNames: ["Griff | Magnet"], category: "magnet" },
  { label: "Stock | Assembled", productNames: ["Stock | Assembled"], category: "other" },
  { label: "Halterung | Assembled", productNames: ["Halterung | Assembled"], category: "other" },
  { label: "Pistenteller | Kein Magnet", productNames: ["Pistenteller | Kein Magnet"], category: "kein_magnet" },
  { label: "Pistenteller | Magnet", productNames: ["Pistenteller | Magnet"], category: "magnet" },
  { label: "Tiefschneeteller | Kein Magnet", productNames: ["Tiefschneeteller Matt | Kein Magnet", "Tiefschneeteller Shiny | Kein Magnet"], category: "kein_magnet" },
  { label: "Tiefschneeteller | Magnet", productNames: ["Tiefschneeteller Matt | Magnet", "Tiefschneeteller Shiny | Magnet"], category: "magnet" },
  { label: "Mutter", productNames: ["Mutter"], category: "other" },
]

export type MatrixCell = {
  quantity: number
  minimumStock: number
  needsReorder: boolean
}

export type MatrixRow = {
  label: string
  category: "magnet" | "kein_magnet" | "other"
  cells: Record<string, MatrixCell | null>
}

export type PoleMatrixResult = {
  success: boolean
  data?: { rows: MatrixRow[]; colors: string[] }
  message?: string
}

/** Extract the canonical color from an item's variant selections */
function getColor(item: InventoryItem): string | null {
  for (const sel of item.variantSelections) {
    const val = sel.optionValue.toLowerCase()
    // Direct match against known colors
    const idx = COLORS_LOWER.indexOf(val)
    if (idx !== -1) return COLORS[idx]
    // Alias match (e.g. "Gelb" → "Neongelb", "Grün" → "Neongrün")
    const alias = COLOR_ALIASES[val]
    if (alias) return alias
  }
  return null
}

function matchesRow(item: InventoryItem, rowDef: MatrixRowDef): boolean {
  const name = item.productName.toLowerCase()
  return rowDef.productNames.some((pn) => pn.toLowerCase() === name)
}

export async function getPoleMatrixData(): Promise<PoleMatrixResult> {
  try {
    const result = await getInventory()
    if (!result.success || !result.data) {
      return { success: false, message: "Fehler beim Laden der Inventardaten" }
    }

    const allItems = result.data

    const rows: MatrixRow[] = ROW_DEFINITIONS.map((rowDef) => {
      const matchingItems = allItems.filter((item) => matchesRow(item, rowDef))

      const cells: Record<string, MatrixCell | null> = {}

      for (const color of COLORS) {
        const colorItems = matchingItems.filter(
          (item) => getColor(item) === color
        )

        if (colorItems.length === 0) {
          cells[color] = null
        } else {
          const totalQuantity = colorItems.reduce(
            (sum, item) => sum + parseFloat(item.quantityOnHand),
            0
          )
          const totalMinStock = colorItems.reduce(
            (sum, item) => sum + parseFloat(item.minimumStockLevel),
            0
          )

          cells[color] = {
            quantity: totalQuantity,
            minimumStock: totalMinStock,
            needsReorder: totalQuantity <= totalMinStock,
          }
        }
      }

      return {
        label: rowDef.label,
        category: rowDef.category,
        cells,
      }
    })

    return { success: true, data: { rows, colors: [...COLORS] } }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unbekannter Fehler",
    }
  }
}
