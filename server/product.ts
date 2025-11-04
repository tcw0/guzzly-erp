"use server"

import {
  products,
  billOfMaterials,
  inventory,
  inventoryMovements,
  productVariations,
  productVariationOptions,
} from "@/db/schema"
import { db } from "@/db/drizzle"
import { OutputParams, ProductParams } from "@/lib/validation"
import { sql, eq } from "drizzle-orm"
import { inventoryActionEnum } from "@/constants/inventory-actions"

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

export async function getRawProducts() {
  try {
    const result = await db
      .select()
      .from(products)
      .where(sql`type = 'RAW'`)

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch products",
    }
  }
}

export async function getFinishedProducts() {
  try {
    const result = await db
      .select()
      .from(products)
      .where(sql`type != 'RAW'`)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch products",
    }
  }
}

export const createProduct = async (params: ProductParams) => {
  try {
    const { components, variations = [], ...productData } = params

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

      // Create product variations and options
      if (variations && variations.length > 0) {
        // Insert variations and capture ids
        const insertedVariations = await tx
          .insert(productVariations)
          .values(
            variations.map((v) => ({
              productId: product.id,
              name: v.name,
            }))
          )
          .returning()

        // Insert options for each variation
        const optionsToInsert = insertedVariations.flatMap((insertedVar, idx) => {
          const source = variations[idx]
          return (source.options || []).map((opt) => ({
            variationId: insertedVar.id,
            value: opt,
          }))
        })

        if (optionsToInsert.length > 0) {
          await tx.insert(productVariationOptions).values(optionsToInsert)
        }
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
