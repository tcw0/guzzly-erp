"use server"

import { products, materialPerProduct } from "@/db/schema"
import { db } from "@/db/drizzle"

export const createProduct = async (params: ProductParams) => {
  try {
    const { materials, ...productData } = params

    const newProduct = await db.transaction(async (tx) => {
      // Create the product
      const [product] = await tx
        .insert(products)
        .values({
          name: productData.name,
          colors: productData.colors as any,
        })
        .returning()

      // Create material relationships
      if (materials && materials.length > 0) {
        await tx.insert(materialPerProduct).values(
          materials.map((material) => ({
            productId: product.id,
            materialId: material.materialId,
            quantityPerProduct: material.quantityPerProduct.toString(),
          }))
        )
      }

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
