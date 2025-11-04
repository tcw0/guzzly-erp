"use server"

import { sql, eq, desc } from "drizzle-orm"
import { db } from "@/db/drizzle"
import { products, inventory, inventoryMovements } from "@/db/schema"
import { PurchaseParams } from "@/lib/validation"
import { inventoryActionEnum } from "@/constants/inventory-actions"
import { productTypeEnum } from "@/constants/product-types"

export async function createPurchase(params: PurchaseParams) {
  try {
    return await db.transaction(async (tx) => {
      for (const item of params.purchases) {
        const found = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1)

        if (!found[0]) {
          throw new Error(`Product ${item.productId} not found`)
        }

        if (found[0].type !== productTypeEnum.enum.RAW) {
          throw new Error("Only RAW products can be purchased")
        }

        // Create purchase inventory movement
        await tx.insert(inventoryMovements).values({
          productId: item.productId,
          quantity: item.quantity.toString(),
          action: inventoryActionEnum.enum.PURCHASE,
        })

        // Upsert inventory add quantity
        await tx
          .insert(inventory)
          .values({
            productId: item.productId,
            quantityOnHand: item.quantity.toString(),
          })
          .onConflictDoUpdate({
            target: [inventory.productId],
            set: {
              quantityOnHand: sql`${inventory.quantityOnHand} + ${item.quantity}`,
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


export async function getPurchases() {
  try {
    const result = await db
      .select({
        id: inventoryMovements.id,
        productId: inventoryMovements.productId,
        productName: products.name,
        unit: products.unit,
        quantity: inventoryMovements.quantity,
        createdAt: inventoryMovements.createdAt,
      })
      .from(inventoryMovements)
      .leftJoin(products, eq(products.id, inventoryMovements.productId))
      .where(eq(inventoryMovements.action, inventoryActionEnum.enum.PURCHASE))
      .orderBy(desc(inventoryMovements.createdAt))

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch purchases",
    }
  }
}

