import { sql, eq } from "drizzle-orm"
import { db } from "@/db/drizzle"
import {
  products,
  billOfMaterials,
  inventory,
  inventoryMovements,
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

        // Get bill of materials for the product
        const bom = await tx
          .select()
          .from(billOfMaterials)
          .where(eq(billOfMaterials.productId, output.productId))

        // Create output inventory movement
        await tx.insert(inventoryMovements).values({
          productId: output.productId,
          quantity: output.quantity.toString(),
          action: inventoryActionEnum.enum.OUTPUT,
        })

        // Update inventory for produced item
        await tx
          .insert(inventory)
          .values({
            productId: output.productId,
            quantityOnHand: output.quantity.toString(),
          })
          .onConflictDoUpdate({
            target: [inventory.productId],
            set: {
              quantityOnHand: sql`${inventory.quantityOnHand} + ${output.quantity}`,
            },
          })

        // Process components consumption
        for (const component of bom) {
          const requiredQuantity =
            parseFloat(component.quantityRequired.toString()) * output.quantity

          // Create consumption movement
          await tx.insert(inventoryMovements).values({
            productId: component.componentId,
            quantity: (-requiredQuantity).toString(),
            action: "CONSUMPTION",
          })

          // Update inventory for consumed components
          const result = await tx
            .insert(inventory)
            .values({
              productId: component.componentId,
              quantityOnHand: (-requiredQuantity).toString(),
            })
            .onConflictDoUpdate({
              target: [inventory.productId],
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
