"use server"

import { sql, eq } from "drizzle-orm"
import { db } from "@/db/drizzle"
import {
  products,
  variantBillOfMaterials,
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

        // Get variant-aware bill of materials for the product variant
        const bom = await tx
          .select()
          .from(variantBillOfMaterials)
          .where(eq(variantBillOfMaterials.productVariantId, variantId))

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

        // Process components consumption using variant-aware BOM
        for (const componentBom of bom) {
          const requiredQuantity =
            parseFloat(componentBom.quantityRequired.toString()) * output.quantity

          const componentVariantId = componentBom.componentVariantId

          // Get component product ID from variant
          const componentVariant = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.id, componentVariantId))
            .limit(1)

          if (!componentVariant[0]) {
            throw new Error(
              `Component variant ${componentVariantId} not found`
            )
          }

          const componentProductId = componentVariant[0].productId

          // Create consumption movement
          await tx.insert(inventoryMovements).values({
            productId: componentProductId,
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
