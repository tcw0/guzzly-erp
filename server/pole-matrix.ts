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
  weiss: "Weiß",
  gelb: "Neongelb",
  grün: "Neongrün",
}

const COLORS_LOWER = COLORS.map((c) => c.toLowerCase())

export type MatrixCell = {
  quantity: number
  minimumStock: number
  needsReorder: boolean
}

export type MatrixRow = {
  label: string
  category: "magnet" | "kein_magnet" | "other"
  type: "RAW" | "INTERMEDIATE" | "FINAL"
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
    const idx = COLORS_LOWER.indexOf(val)
    if (idx !== -1) return COLORS[idx]
    const alias = COLOR_ALIASES[val]
    if (alias) return alias
  }
  return null
}

/** Derive category from product name */
function getCategory(productName: string): MatrixRow["category"] {
  const lower = productName.toLowerCase()
  if (lower.includes("kein magnet")) return "kein_magnet"
  if (lower.includes("magnet")) return "magnet"
  return "other"
}

export async function getPoleMatrixData(): Promise<PoleMatrixResult> {
  try {
    const result = await getInventory()
    if (!result.success || !result.data) {
      return { success: false, message: "Fehler beim Laden der Inventardaten" }
    }

    const allItems = result.data

    // Group items by exact product name (as stored in DB)
    const byProduct = new Map<string, InventoryItem[]>()
    for (const item of allItems) {
      if (!byProduct.has(item.productName)) {
        byProduct.set(item.productName, [])
      }
      byProduct.get(item.productName)!.push(item)
    }

    // Sort product names alphabetically for consistent ordering
    const sortedProductNames = [...byProduct.keys()].sort()

    const rows: MatrixRow[] = sortedProductNames.map((productName) => {
      const matchingItems = byProduct.get(productName)!
      const cells: Record<string, MatrixCell | null> = {}

      for (const color of COLORS) {
        const colorItems = matchingItems.filter((item) => getColor(item) === color)

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
        label: productName,
        category: getCategory(productName),
        type: (matchingItems[0]?.type ?? "RAW") as "RAW" | "INTERMEDIATE" | "FINAL",
        cells,
      }
    })

    return { success: true, data: { rows, colors: [...COLORS] } }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unbekannter Fehler",
    }
  }
}
