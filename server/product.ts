"use server"

import {
  products,
  variantBillOfMaterials,
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

// Helper function to generate SKU from product name
// SKU Format: PRODUCTCODE-OPTION1-OPTION2-PRODUCTID
// Example: BASK-RED-LRG-A3F2E1
// - PRODUCTCODE: First 3-4 letters of product name (e.g., BASK for "Basket")
// - OPTION1, OPTION2: Variation options (e.g., RED, LRG)
// - PRODUCTID: First 6 chars of product UUID for guaranteed uniqueness
function generateProductCode(productName: string): string {
  // Take first 3-4 uppercase letters, remove spaces and special characters
  const cleaned = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 4)

  // If too short, pad with product name characters
  if (cleaned.length < 3) {
    return (
      productName.toUpperCase().replace(/[^A-Z0-9]/g, "") + "000"
    ).substring(0, 4)
  }

  return cleaned
}

// Helper function to generate option code from option value
function generateOptionCode(optionValue: string): string {
  // Take first 2-3 uppercase letters, remove spaces and special characters
  return optionValue
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 3)
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
        const optionsToInsert = insertedVariations.flatMap(
          (insertedVar, idx) => {
            const source = variations[idx]
            return (source.options || []).map((opt) => ({
              variationId: insertedVar.id,
              value: opt,
            }))
          }
        )

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

        // Generate product code for SKU prefix
        const productCode = generateProductCode(productData.name)
        
        // Generate short unique ID from product UUID (first 6 chars)
        const shortProductId = product.id.split('-')[0].substring(0, 6).toUpperCase()

        // Create variants for each combination with SKU
        const variantsToInsert = combinations.map((combo) => {
          // Build SKU: PRODUCT-OPTION1-OPTION2-PRODUCTID
          // Ensure option codes are in the same order as variations
          const optionCodes = insertedVariations
            .map((variation) => {
              const comboItem = combo.find(
                (c) => c.variationId === variation.id
              )
              if (!comboItem) return ""
              const option = insertedOptions.find(
                (opt) => opt.id === comboItem.optionId
              )
              return option ? generateOptionCode(option.value) : ""
            })
            .filter(Boolean)

          const sku =
            optionCodes.length > 0
              ? `${productCode}-${optionCodes.join("-")}-${shortProductId}`
              : `${productCode}-DEFAULT-${shortProductId}`

          return {
            productId: product.id,
            sku: sku,
          }
        })

        // Check for SKU collisions before inserting (safety check)
        const skusToCheck = variantsToInsert.map(v => v.sku)
        const existingVariants = await tx
          .select({ sku: productVariants.sku })
          .from(productVariants)
          .where(sql`${productVariants.sku} = ANY(ARRAY[${sql.join(skusToCheck.map(sku => sql`${sku}`), sql`, `)}])`)
        
        if (existingVariants.length > 0) {
          throw new Error(
            `SKU collision detected: ${existingVariants.map(v => v.sku).join(', ')}. This should not happen - please contact support.`
          )
        }

        const insertedVariants = await tx
          .insert(productVariants)
          .values(variantsToInsert)
          .returning()

        // Create variant selections for each combination
        const selectionsToInsert = insertedVariants.flatMap(
          (variant, variantIdx) => {
            return combinations[variantIdx].map((combo) => ({
              variantId: variant.id,
              variationId: combo.variationId,
              optionId: combo.optionId,
            }))
          }
        )

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
        // No variations - create one default variant with SKU
        const productCode = generateProductCode(productData.name)
        
        // Generate short unique ID from product UUID (first 6 chars)
        const shortProductId = product.id.split('-')[0].substring(0, 6).toUpperCase()
        
        const [defaultVariant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            sku: `${productCode}-DEFAULT-${shortProductId}`,
          })
          .returning()

        // Create initial inventory entry with zero quantity
        await tx.insert(inventory).values({
          variantId: defaultVariant.id,
          quantityOnHand: "0",
        })
      }

      // Get all product variants for BOM creation
      const allProductVariants = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, product.id))

      // Create variant-aware bill of materials
      if (components && components.length > 0) {
        // Get product variant selections
        const productVariantSelectionsMap = new Map<
          string,
          Array<{ variationName: string; optionValue: string }>
        >()

        if (allProductVariants.length > 0) {
          const variantIds = allProductVariants.map((v) => v.id)
          const allSelections = await tx
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

          for (const sel of allSelections) {
            if (variantIds.includes(sel.variantId)) {
              if (!productVariantSelectionsMap.has(sel.variantId)) {
                productVariantSelectionsMap.set(sel.variantId, [])
              }
              productVariantSelectionsMap.get(sel.variantId)!.push({
                variationName: sel.variationName,
                optionValue: sel.optionValue,
              })
            }
          }
        }

        for (const component of components) {
          // Get component product and its variants
          const componentProduct = await tx
            .select()
            .from(products)
            .where(eq(products.id, component.componentId))
            .limit(1)

          if (!componentProduct[0]) {
            throw new Error(`Component product ${component.componentId} not found`)
          }

          const componentVariants = await tx
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, component.componentId))

          if (componentVariants.length === 0) {
            throw new Error(
              `No variants found for component ${component.componentId}`
            )
          }

          // Get component variant selections
          const componentVariantSelectionsMap = new Map<
            string,
            Array<{ variationName: string; optionValue: string }>
          >()

          const componentVariantIds = componentVariants.map((v) => v.id)
          const componentSelections = await tx
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

          for (const sel of componentSelections) {
            if (componentVariantIds.includes(sel.variantId)) {
              if (!componentVariantSelectionsMap.has(sel.variantId)) {
                componentVariantSelectionsMap.set(sel.variantId, [])
              }
              componentVariantSelectionsMap.get(sel.variantId)!.push({
                variationName: sel.variationName,
                optionValue: sel.optionValue,
              })
            }
          }

          // For each product variant, find matching component variant
          for (const productVariant of allProductVariants) {
            const productSelections =
              productVariantSelectionsMap.get(productVariant.id) || []

            // Find matching component variant based on mapping rules
            let matchingComponentVariant = componentVariants[0] // Default to first variant

            if (component.variantMappingRules && component.variantMappingRules.length > 0) {
              // Use mapping rules to find matching component variant
              for (const componentVariant of componentVariants) {
                const componentSelections =
                  componentVariantSelectionsMap.get(componentVariant.id) || []
                let matches = true

                for (const rule of component.variantMappingRules) {
                  const componentSelection = componentSelections.find(
                    (s) => s.variationName === rule.componentVariationName
                  )

                  if (rule.strategy === "mapped" && rule.productVariationName) {
                    // Strategy: Map to specific product variation
                    const productSelection = productSelections.find(
                      (s) => s.variationName === rule.productVariationName
                    )
                    
                    if (!productSelection) {
                      matches = false
                      break
                    }
                    
                    if (
                      !componentSelection ||
                      componentSelection.optionValue !== productSelection.optionValue
                    ) {
                      matches = false
                      break
                    }
                  } else if (rule.strategy === "default" && rule.defaultOptionValue) {
                    // Strategy: Use fixed default value
                    if (
                      !componentSelection ||
                      componentSelection.optionValue !== rule.defaultOptionValue
                    ) {
                      matches = false
                      break
                    }
                  } else {
                    // Invalid rule configuration - should not happen with proper validation
                    throw new Error(
                      `Invalid mapping rule for component variation "${rule.componentVariationName}"`
                    )
                  }
                }

                if (matches) {
                  matchingComponentVariant = componentVariant
                  break
                }
              }
            } else {
              // No mapping rules provided - this should not happen for components with variations
              throw new Error(
                `Variant mapping rules are required for component ${component.componentId} which has variations`
              )
            }

            // Create variant BOM entry
            await tx.insert(variantBillOfMaterials).values({
              productVariantId: productVariant.id,
              componentVariantId: matchingComponentVariant.id,
              quantityRequired: component.quantityRequired.toString(),
            })
          }
        }
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
        error instanceof Error
          ? error.message
          : "Failed to fetch product variants",
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
