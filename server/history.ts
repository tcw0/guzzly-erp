"use server"

import { db } from "@/db/drizzle"
import {
  inventoryMovements,
  products,
  productVariantSelections,
  productVariations,
  productVariationOptions,
} from "@/db/schema"
import { eq, inArray, desc } from "drizzle-orm"
import { unstable_noStore as noStore } from "next/cache"
import { INVENTORY_ACTIONS } from "@/constants/inventory-actions"

export type HistoryEntry = {
  id: string
  type: "Output" | "Adjustment"
  productName: string
  variantLabel: string
  quantity: string
  reason: string | null
  createdBy: string | null
  createdAt: string
  createdAtRaw: string
}

/**
 * Liefert alle Einträge aus Output und Adjustment (inventory_movements)
 * für die Home-History-Tabelle inkl. Produktname und Varianten-Optionen (z. B. Farbe).
 */
export async function getOutputAndAdjustmentHistory(): Promise<{
  success: boolean
  data?: HistoryEntry[]
  message?: string
}> {
  noStore()
  try {
    const movements = await db
      .select({
        id: inventoryMovements.id,
        productId: inventoryMovements.productId,
        variantId: inventoryMovements.variantId,
        quantity: inventoryMovements.quantity,
        action: inventoryMovements.action,
        reason: inventoryMovements.reason,
        createdBy: inventoryMovements.createdBy,
        createdAt: inventoryMovements.createdAt,
        productName: products.name,
      })
      .from(inventoryMovements)
      .innerJoin(products, eq(products.id, inventoryMovements.productId))
      .where(
        inArray(inventoryMovements.action, [
          INVENTORY_ACTIONS[1],
          INVENTORY_ACTIONS[3],
        ])
      )
      .orderBy(desc(inventoryMovements.createdAt))

    const variantIds = [
      ...new Set(
        movements
          .map((m) => m.variantId)
          .filter((id): id is string => id != null)
      ),
    ]

    const selectionsMap = new Map<
      string,
      Array<{ variationName: string; optionValue: string }>
    >()

    if (variantIds.length > 0) {
      const selections = await db
        .select({
          variantId: productVariantSelections.variantId,
          variationName: productVariations.name,
          optionValue: productVariationOptions.value,
        })
        .from(productVariantSelections)
        .innerJoin(
          productVariations,
          eq(productVariations.id, productVariantSelections.variationId)
        )
        .innerJoin(
          productVariationOptions,
          eq(productVariationOptions.id, productVariantSelections.optionId)
        )
        .where(inArray(productVariantSelections.variantId, variantIds))

      for (const s of selections) {
        if (!selectionsMap.has(s.variantId)) {
          selectionsMap.set(s.variantId, [])
        }
        selectionsMap.get(s.variantId)!.push({
          variationName: s.variationName,
          optionValue: s.optionValue,
        })
      }
    }

    const data: HistoryEntry[] = movements.map((m) => {
      const action = m.action as string
      const type: "Output" | "Adjustment" =
        action === INVENTORY_ACTIONS[1] ? "Output" : "Adjustment"
      const selections = (m.variantId && selectionsMap.get(m.variantId)) || []
      const variantLabel = selections
        .map((s) => `${s.variationName}: ${s.optionValue}`)
        .join(", ")
      const createdAt = m.createdAt
        ? new Date(m.createdAt).toISOString()
        : ""
      const createdAtFormatted = m.createdAt
        ? new Date(m.createdAt).toLocaleString("de-DE", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : ""

      return {
        id: m.id,
        type,
        productName: m.productName ?? "",
        variantLabel,
        quantity: String(m.quantity),
        reason: m.reason ?? null,
        createdBy: m.createdBy ?? null,
        createdAt: createdAtFormatted,
        createdAtRaw: createdAt,
      }
    })

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Fehler beim Laden der History",
    }
  }
}
