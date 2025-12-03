"use server"

import { db } from "@/db/drizzle"
import {
  products,
  inventory,
  productVariants,
  productVariantSelections,
  productVariations,
  productVariationOptions,
} from "@/db/schema"
import { eq } from "drizzle-orm"

export type InventoryItem = {
  id: string
  productId: string
  productName: string
  type: "RAW" | "INTERMEDIATE" | "FINAL"
  unit: string
  variantId: string
  quantityOnHand: string
  minimumStockLevel: string
  needsReorder: boolean
  variantSelections: Array<{
    variationName: string
    optionValue: string
  }>
}

export async function getInventory() {
  try {
    // Get all inventory entries with variants
    const inventoryRows = await db
      .select({
        variant: productVariants,
        product: products,
        inventory: inventory,
      })
      .from(inventory)
      .innerJoin(productVariants, eq(productVariants.id, inventory.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))

    // Get all variant selections for the variants we found
    const variantIds = inventoryRows.map((r) => r.variant.id)
    
    // Group selections by variantId
    const selectionsMap = new Map<string, Array<{ variationName: string; optionValue: string }>>()
    
    // Get all selections - we'll filter by variantId in memory
    const allSelections = await db
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

    // Only include selections for variants that are in inventory
    for (const sel of allSelections) {
      if (variantIds.includes(sel.variantId)) {
        if (!selectionsMap.has(sel.variantId)) {
          selectionsMap.set(sel.variantId, [])
        }
        selectionsMap.get(sel.variantId)!.push({
          variationName: sel.variationName,
          optionValue: sel.optionValue,
        })
      }
    }

    const data: InventoryItem[] = inventoryRows.map((r) => {
      const quantityOnHand = parseFloat(r.inventory.quantityOnHand.toString())
      const minimumStockLevel = parseFloat(r.variant.minimumStockLevel.toString())
      
      return {
        id: r.variant.id,
        productId: r.product.id,
        productName: r.product.name,
        type: r.product.type as InventoryItem["type"],
        unit: r.product.unit,
        variantId: r.variant.id,
        quantityOnHand: r.inventory.quantityOnHand.toString(),
        minimumStockLevel: r.variant.minimumStockLevel.toString(),
        needsReorder: quantityOnHand <= minimumStockLevel,
        variantSelections: selectionsMap.get(r.variant.id) || [],
      }
    })

    return { success: true as const, data }
  } catch (error) {
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "An error occurred",
    }
  }
}


