"use server"

import { sql, eq } from "drizzle-orm"
import { db } from "@/db/drizzle"
import {
  products,
  inventory,
  inventoryMovements,
  productVariants,
} from "@/db/schema"
import { AdjustmentParams } from "@/lib/validation"
import { inventoryActionEnum } from "@/constants/inventory-actions"
import { unstable_noStore as noStore } from "next/cache"

export async function createAdjustment(params: AdjustmentParams) {
  try {
    return await db.transaction(async (tx) => {
      for (const item of params.adjustments) {
        const found = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1)

        if (!found[0]) {
          throw new Error(`Product ${item.productId} not found`)
        }

        // Get variantId - use provided one or find default variant
        let variantId = item.variantId
        if (!variantId) {
          const variants = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, item.productId))
            .limit(1)

          if (!variants[0]) {
            throw new Error(`No variant found for product ${item.productId}`)
          }
          variantId = variants[0].id
        }

        // Verify variant belongs to product
        const variant = await tx
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, variantId))
          .limit(1)

        if (!variant[0] || variant[0].productId !== item.productId) {
          throw new Error(`Invalid variant for product ${item.productId}`)
        }

        // Calculate the actual quantity based on direction
        const actualQuantity = item.direction === "decrease" ? -item.quantity : item.quantity

        // Create adjustment inventory movement
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          variantId: variantId,
          quantity: actualQuantity.toString(),
          action: inventoryActionEnum.enum.ADJUSTMENT,
          reason: item.reason || null,
        })

        // Update inventory - add or subtract quantity
        await tx
          .insert(inventory)
          .values({
            variantId: variantId,
            quantityOnHand: actualQuantity.toString(),
          })
          .onConflictDoUpdate({
            target: [inventory.variantId],
            set: {
              quantityOnHand: sql`${inventory.quantityOnHand} + ${actualQuantity}`,
            },
          })
      }

      return { success: true }
    })
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "An error occurred",
    }
  }
}

export async function getAdjustments() {
  noStore()
  try {
    const result = await db
      .select({
        id: inventoryMovements.id,
        productId: inventoryMovements.productId,
        productName: products.name,
        unit: products.unit,
        quantity: inventoryMovements.quantity,
        reason: inventoryMovements.reason,
        createdAt: inventoryMovements.createdAt,
      })
      .from(inventoryMovements)
      .leftJoin(products, eq(products.id, inventoryMovements.productId))
      .where(eq(inventoryMovements.action, inventoryActionEnum.enum.ADJUSTMENT))
      .orderBy(sql`${inventoryMovements.createdAt} DESC`)

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch adjustments",
    }
  }
}
