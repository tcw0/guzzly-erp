"use server"

import { sql, eq } from "drizzle-orm"
import { db } from "@/db/drizzle"
import {
  products,
  billOfMaterials,
  inventory,
  inventoryMovements,
  productVariants,
} from "@/db/schema"
import { OutputParams } from "@/lib/validation"
import { inventoryActionEnum } from "@/constants/inventory-actions"

export async function createOutput(params: OutputParams) {
  try {
    return await db.transaction(async (tx) => {
      for (const output of params.outputs) {
        // Get the product and its components
        const product = await tx
          .select()
          .from(products)
          .where(eq(products.id, output.productId))
          .limit(1)

        if (!product[0]) {
          throw new Error(`Product ${output.productId} not found`)
        }

        // Get variantId - use provided one or find default variant
        let variantId = output.variantId
        if (!variantId) {
          const variants = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, output.productId))
            .limit(1)

          if (!variants[0]) {
            throw new Error(`No variant found for product ${output.productId}`)
          }
          variantId = variants[0].id
        }

        // Verify variant belongs to product
        const variant = await tx
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, variantId))
          .limit(1)

        if (!variant[0] || variant[0].productId !== output.productId) {
          throw new Error(`Invalid variant for product ${output.productId}`)
        }

        // Get bill of materials for the product
        const bom = await tx
          .select()
          .from(billOfMaterials)
          .where(eq(billOfMaterials.productId, output.productId))

        // Create output inventory movement
        await tx.insert(inventoryMovements).values({
          productId: output.productId,
          variantId: variantId,
          quantity: output.quantity.toString(),
          action: inventoryActionEnum.enum.OUTPUT,
        })

        // Update inventory for produced item
        await tx
          .insert(inventory)
          .values({
            variantId: variantId,
            quantityOnHand: output.quantity.toString(),
          })
          .onConflictDoUpdate({
            target: [inventory.variantId],
            set: {
              quantityOnHand: sql`${inventory.quantityOnHand} + ${output.quantity}`,
            },
          })

        // Process components consumption
        // Note: For components, we consume from default variant (components typically don't have variations)
        for (const component of bom) {
          const requiredQuantity =
            parseFloat(component.quantityRequired.toString()) * output.quantity

          // Find default variant for component
          const componentVariants = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, component.componentId))
            .limit(1)

          if (!componentVariants[0]) {
            throw new Error(
              `No variant found for component ${component.componentId}`
            )
          }

          const componentVariantId = componentVariants[0].id

          // Create consumption movement
          await tx.insert(inventoryMovements).values({
            productId: component.componentId,
            variantId: componentVariantId,
            quantity: (-requiredQuantity).toString(),
            action: "CONSUMPTION",
          })

          // Update inventory for consumed components
          const result = await tx
            .insert(inventory)
            .values({
              variantId: componentVariantId,
              quantityOnHand: (-requiredQuantity).toString(),
            })
            .onConflictDoUpdate({
              target: [inventory.variantId],
              set: {
                quantityOnHand: sql`${inventory.quantityOnHand} - ${requiredQuantity}`,
              },
            })
            .returning({ newQuantity: inventory.quantityOnHand })

          if (parseFloat(result[0].newQuantity.toString()) < 0) {
            throw new Error(
              `Insufficient inventory for component ${component.componentId}`
            )
          }
        }
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
