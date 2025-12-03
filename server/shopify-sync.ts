"use server"

import { db } from "@/db/drizzle"
import {
  products,
  productVariants,
  productVariantSelections,
  productVariations,
  productVariationOptions,
  shopifyVariantMappings,
} from "@/db/schema"
import { shopifyAdminAPI, shopifyRateLimiter } from "@/lib/shopify"
import { eq, and, isNull } from "drizzle-orm"

// Types for Shopify API responses
interface ShopifyVariant {
  id: number
  product_id: number
  title: string
  sku: string
  price: string
  inventory_quantity: number
}

interface ShopifyProduct {
  id: number
  title: string
  variants: ShopifyVariant[]
  status: string
}

/**
 * Fetch all products from Shopify Admin API
 * Returns simplified structure for mapping UI
 */
export async function fetchShopifyProducts() {
  try {
    const allProducts: ShopifyProduct[] = []
    let hasNextPage = true
    let pageInfo: string | null = null

    // Paginate through all products
    while (hasNextPage) {
      await shopifyRateLimiter.wait()

      const endpoint: string = pageInfo
        ? `/products.json?limit=250&page_info=${pageInfo}`
        : `/products.json?limit=250`

      const response: { products: ShopifyProduct[] } = await shopifyAdminAPI<{
        products: ShopifyProduct[]
      }>(endpoint)

      allProducts.push(...response.products)

      // Check for next page (simplified - real implementation uses Link header)
      hasNextPage = response.products.length === 250
      pageInfo = hasNextPage ? String(allProducts.length) : null
    }

    // Transform for UI consumption
    const shopifyVariants = allProducts.flatMap((product) =>
      product.variants.map((variant) => ({
        shopifyProductId: String(product.id),
        shopifyVariantId: String(variant.id),
        productTitle: product.title,
        variantTitle: variant.title,
        shopifySku: variant.sku || "",
        price: variant.price,
        inventoryQuantity: variant.inventory_quantity,
      }))
    )

    return {
      success: true,
      variants: shopifyVariants,
      totalCount: shopifyVariants.length,
    }
  } catch (error) {
    console.error("Error fetching Shopify products:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      variants: [],
      totalCount: 0,
    }
  }
}

/**
 * Get all FINAL product variants from ERP with their variation details
 * These are the only products that should be mapped to Shopify
 */
export async function getERPFinalProducts() {
  try {
    // Get all FINAL products with their variants
    const finalProducts = await db
      .select({
        productId: products.id,
        productName: products.name,
        productType: products.type,
        productUnit: products.unit,
        variantId: productVariants.id,
        variantSku: productVariants.sku,
        minimumStockLevel: productVariants.minimumStockLevel,
      })
      .from(products)
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .where(eq(products.type, "FINAL"))

    // Get variation selections for each variant (e.g., Color: Red, Size: Large)
    const variantsWithSelections = await Promise.all(
      finalProducts.map(async (variant) => {
        if (!variant.variantId) return variant

        const selections = await db
          .select({
            variationName: productVariations.name,
            optionValue: productVariationOptions.value,
          })
          .from(productVariantSelections)
          .leftJoin(
            productVariations,
            eq(productVariantSelections.variationId, productVariations.id)
          )
          .leftJoin(
            productVariationOptions,
            eq(productVariantSelections.optionId, productVariationOptions.id)
          )
          .where(eq(productVariantSelections.variantId, variant.variantId))

        return {
          ...variant,
          variations: selections,
          variantDisplay: selections.length
            ? `${variant.productName} (${selections.map((s) => s.optionValue).join(", ")})`
            : variant.productName,
        }
      })
    )

    return {
      success: true,
      variants: variantsWithSelections,
      totalCount: variantsWithSelections.length,
    }
  } catch (error) {
    console.error("Error fetching ERP final products:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      variants: [],
      totalCount: 0,
    }
  }
}

/**
 * Get all existing mappings between Shopify and ERP variants
 */
export async function getExistingMappings() {
  try {
    const mappings = await db
      .select({
        id: shopifyVariantMappings.id,
        shopifyProductId: shopifyVariantMappings.shopifyProductId,
        shopifyVariantId: shopifyVariantMappings.shopifyVariantId,
        productVariantId: shopifyVariantMappings.productVariantId,
        syncStatus: shopifyVariantMappings.syncStatus,
        lastSyncedAt: shopifyVariantMappings.lastSyncedAt,
        syncErrors: shopifyVariantMappings.syncErrors,
        // Join to get ERP product details
        erpProductName: products.name,
        erpVariantSku: productVariants.sku,
      })
      .from(shopifyVariantMappings)
      .leftJoin(
        productVariants,
        eq(shopifyVariantMappings.productVariantId, productVariants.id)
      )
      .leftJoin(products, eq(productVariants.productId, products.id))

    return {
      success: true,
      mappings,
      totalCount: mappings.length,
    }
  } catch (error) {
    console.error("Error fetching existing mappings:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      mappings: [],
      totalCount: 0,
    }
  }
}

/**
 * Create a manual mapping between Shopify variant and ERP variant
 */
export async function createVariantMapping(data: {
  shopifyProductId: string
  shopifyVariantId: string
  erpVariantId: string
}) {
  try {
    // Validate ERP variant is FINAL type
    const [erpVariant] = await db
      .select({
        variantId: productVariants.id,
        productType: products.type,
      })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.id, data.erpVariantId))
      .limit(1)

    if (!erpVariant) {
      return {
        success: false,
        error: "ERP variant not found",
      }
    }

    if (erpVariant.productType !== "FINAL") {
      return {
        success: false,
        error: "Only FINAL products can be mapped to Shopify",
      }
    }

    // Check if mapping already exists
    const [existing] = await db
      .select()
      .from(shopifyVariantMappings)
      .where(eq(shopifyVariantMappings.shopifyVariantId, data.shopifyVariantId))
      .limit(1)

    if (existing) {
      // Update existing mapping
      const [updated] = await db
        .update(shopifyVariantMappings)
        .set({
          productVariantId: data.erpVariantId,
          syncStatus: "active",
          lastSyncedAt: new Date(),
          syncErrors: null,
          updatedAt: new Date(),
        })
        .where(eq(shopifyVariantMappings.id, existing.id))
        .returning()

      return {
        success: true,
        mapping: updated,
        message: "Mapping updated successfully",
      }
    } else {
      // Create new mapping
      const [created] = await db
        .insert(shopifyVariantMappings)
        .values({
          shopifyProductId: data.shopifyProductId,
          shopifyVariantId: data.shopifyVariantId,
          productVariantId: data.erpVariantId,
          syncStatus: "active",
          lastSyncedAt: new Date(),
        })
        .returning()

      return {
        success: true,
        mapping: created,
        message: "Mapping created successfully",
      }
    }
  } catch (error) {
    console.error("Error creating variant mapping:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Delete a variant mapping
 */
export async function deleteVariantMapping(mappingId: string) {
  try {
    await db
      .delete(shopifyVariantMappings)
      .where(eq(shopifyVariantMappings.id, mappingId))

    return {
      success: true,
      message: "Mapping deleted successfully",
    }
  } catch (error) {
    console.error("Error deleting variant mapping:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Bulk create mappings (for CSV import or batch operations)
 */
export async function bulkCreateMappings(
  mappings: Array<{
    shopifyProductId: string
    shopifyVariantId: string
    erpVariantId: string
  }>
) {
  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const mapping of mappings) {
      const result = await createVariantMapping(mapping)
      if (result.success) {
        results.success++
      } else {
        results.failed++
        results.errors.push(
          `Shopify Variant ${mapping.shopifyVariantId}: ${result.error}`
        )
      }
    }

    return {
      success: true,
      results,
    }
  } catch (error) {
    console.error("Error bulk creating mappings:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get mapping statistics for dashboard
 */
export async function getMappingStats() {
  try {
    const erpFinalProducts = await db
      .select()
      .from(products)
      .where(eq(products.type, "FINAL"))

    const mappings = await getExistingMappings()
    const shopifyProducts = await fetchShopifyProducts()

    const totalERPFinal = erpFinalProducts.length

    return {
      success: true,
      stats: {
        totalERPFinalProducts: totalERPFinal,
        totalShopifyVariants: shopifyProducts.totalCount,
        totalMapped: mappings.totalCount,
        unmappedERP: totalERPFinal - mappings.totalCount,
        unmappedShopify: shopifyProducts.totalCount - mappings.totalCount,
        mappingPercentage:
          shopifyProducts.totalCount > 0
            ? Math.round(
                (mappings.totalCount / shopifyProducts.totalCount) * 100
              )
            : 0,
      },
    }
  } catch (error) {
    console.error("Error getting mapping stats:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stats: null,
    }
  }
}
