"use server"

import {
  products,
  billOfMaterials,
  inventory,
  inventoryMovements,
  productVariations,
  productVariationOptions,
  productVariants,
  productVariantSelections,
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

// Helper function to generate all combinations of variation options
function generateCombinations<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  if (arrays.length === 1) return arrays[0].map((item) => [item])

  const [first, ...rest] = arrays
  const combinations = generateCombinations(rest)
  const result: T[][] = []

  for (const item of first) {
    for (const combo of combinations) {
      result.push([item, ...combo])
    }
  }

  return result
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

      let insertedVariations: (typeof productVariations.$inferSelect)[] = []
      let insertedOptions: (typeof productVariationOptions.$inferSelect)[] = []

      // Create product variations and options
      if (variations && variations.length > 0) {
        // Insert variations and capture ids
        insertedVariations = await tx
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
          insertedOptions = await tx
            .insert(productVariationOptions)
            .values(optionsToInsert)
            .returning()
        }

        // Generate all variant combinations
        const variationOptionArrays = insertedVariations.map((variation) => {
          return insertedOptions
            .filter((opt) => opt.variationId === variation.id)
            .map((opt) => ({ variationId: variation.id, optionId: opt.id }))
        })

        // Generate all combinations
        const combinations = generateCombinations(variationOptionArrays)

        // Create variants for each combination
        const variantsToInsert = combinations.map(() => ({
          productId: product.id,
        }))

        const insertedVariants = await tx
          .insert(productVariants)
          .values(variantsToInsert)
          .returning()

        // Create variant selections for each combination
        const selectionsToInsert = insertedVariants.flatMap((variant, variantIdx) => {
          return combinations[variantIdx].map((combo) => ({
            variantId: variant.id,
            variationId: combo.variationId,
            optionId: combo.optionId,
          }))
        })

        if (selectionsToInsert.length > 0) {
          await tx.insert(productVariantSelections).values(selectionsToInsert)
        }

        // Create inventory entries for each variant
        const inventoryEntries = insertedVariants.map((variant) => ({
          variantId: variant.id,
          quantityOnHand: "0",
        }))

        await tx.insert(inventory).values(inventoryEntries)
      } else {
        // No variations - create one default variant
        const [defaultVariant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
          })
          .returning()

        // Create initial inventory entry with zero quantity
        await tx.insert(inventory).values({
          variantId: defaultVariant.id,
          quantityOnHand: "0",
        })
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

// Get all variants for a product with their variation selections
export async function getProductVariants(productId: string) {
  try {
    const variants = await db
      .select({
        variant: productVariants,
        selections: productVariantSelections,
        option: productVariationOptions,
        variation: productVariations,
      })
      .from(productVariants)
      .leftJoin(
        productVariantSelections,
        eq(productVariantSelections.variantId, productVariants.id)
      )
      .leftJoin(
        productVariationOptions,
        eq(productVariationOptions.id, productVariantSelections.optionId)
      )
      .leftJoin(
        productVariations,
        eq(productVariations.id, productVariantSelections.variationId)
      )
      .where(eq(productVariants.productId, productId))

    // Group by variant
    const variantMap = new Map<
      string,
      {
        variant: typeof productVariants.$inferSelect
        selections: Array<{
          variationName: string
          optionValue: string
          variationId: string
          optionId: string
        }>
      }
    >()

    for (const row of variants) {
      if (!row.variant) continue

      if (!variantMap.has(row.variant.id)) {
        variantMap.set(row.variant.id, {
          variant: row.variant,
          selections: [],
        })
      }

      if (row.selections && row.option && row.variation) {
        variantMap.get(row.variant.id)!.selections.push({
          variationName: row.variation.name,
          optionValue: row.option.value,
          variationId: row.variation.id,
          optionId: row.option.id,
        })
      }
    }

    return {
      success: true,
      data: Array.from(variantMap.values()),
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch product variants",
    }
  }
}

// Get product with its variations structure
export async function getProductWithVariations(productId: string) {
  try {
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product[0]) {
      return {
        success: false,
        message: "Product not found",
      }
    }

    const variations = await db
      .select({
        variation: productVariations,
        options: productVariationOptions,
      })
      .from(productVariations)
      .leftJoin(
        productVariationOptions,
        eq(productVariationOptions.variationId, productVariations.id)
      )
      .where(eq(productVariations.productId, productId))

    // Group options by variation
    const variationMap = new Map<
      string,
      {
        variation: typeof productVariations.$inferSelect
        options: (typeof productVariationOptions.$inferSelect)[]
      }
    >()

    for (const row of variations) {
      if (!row.variation) continue

      if (!variationMap.has(row.variation.id)) {
        variationMap.set(row.variation.id, {
          variation: row.variation,
          options: [],
        })
      }

      if (row.options) {
        variationMap.get(row.variation.id)!.options.push(row.options)
      }
    }

    return {
      success: true,
      data: {
        product: product[0],
        variations: Array.from(variationMap.values()),
      },
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch product with variations",
    }
  }
}
