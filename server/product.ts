"use server"

import { products, billOfMaterials, inventory } from "@/db/schema"
import { db } from "@/db/drizzle"
import { ProductParams } from "@/lib/validation"

export const getProducts = async () => {
  try {
    const result = await db.select().from(products)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      message: "Failed to fetch products",
    }
  }
}

export const createProduct = async (params: ProductParams) => {
  try {
    const { components, ...productData } = params

    const newProduct = await db.transaction(async (tx) => {
      // Create the product
      const [product] = await tx
        .insert(products)
        .values({
          name: productData.name,
          type: productData.type,
          unit: productData.unit,
        })
        .returning()

      // Create bill of materials relationships
      if (components && components.length > 0) {
        await tx.insert(billOfMaterials).values(
          components.map((component) => ({
            productId: product.id,
            componentId: component.componentId,
            quantityRequired: component.quantityRequired.toString(),
          }))
        )
      }

      // Create initial inventory entry with zero quantity
      await tx.insert(inventory).values({
        productId: product.id,
        quantityOnHand: "0",
      })

      return product
    })

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newProduct)),
    }
  } catch (error) {
    console.log(error)

    return {
      success: false,
      message: "An error occurred while creating the product",
    }
  }
}
