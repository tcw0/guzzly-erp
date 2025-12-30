"use server"

import { db } from "@/db/drizzle"
import {
  products,
  productVariants,
  productVariantSelections,
  productVariations,
  productVariationOptions,
  shopifyVariantMappings,
  shopifyPropertyMappings,
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
            ? `${variant.productName} (${selections
                .map((s) => s.optionValue)
                .join(", ")})`
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
        shopifyProductTitle: shopifyVariantMappings.shopifyProductTitle,
        shopifyVariantTitle: shopifyVariantMappings.shopifyVariantTitle,
        productVariantId: shopifyVariantMappings.productVariantId,
        quantity: shopifyVariantMappings.quantity,
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

    // Group mappings by Shopify variant (since one variant can have multiple components)
    const groupedMappings = mappings.reduce((acc, mapping) => {
      const existing = acc.find(
        (m) => m.shopifyVariantId === mapping.shopifyVariantId
      )

      if (existing) {
        existing.components.push({
          id: mapping.id,
          productVariantId: mapping.productVariantId,
          quantity: mapping.quantity,
          erpProductName: mapping.erpProductName,
          erpVariantSku: mapping.erpVariantSku,
        })
      } else {
        acc.push({
          shopifyProductId: mapping.shopifyProductId,
          shopifyVariantId: mapping.shopifyVariantId,
          syncStatus: mapping.syncStatus,
          lastSyncedAt: mapping.lastSyncedAt,
          syncErrors: mapping.syncErrors,
          components: [
            {
              id: mapping.id,
              productVariantId: mapping.productVariantId,
              quantity: mapping.quantity,
              erpProductName: mapping.erpProductName,
              erpVariantSku: mapping.erpVariantSku,
            },
          ],
        })
      }

      return acc
    }, [] as any[])

    return {
      success: true,
      mappings: groupedMappings,
      totalCount: groupedMappings.length, // Count unique Shopify variants
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
 * Create a manual mapping between Shopify variant and ERP components
 * Supports multiple components with quantities (e.g., ski pole set = 2 grips + 2 sticks + ...)
 */
export async function createVariantMapping(data: {
  shopifyProductId: string
  shopifyVariantId: string
  shopifyProductTitle?: string
  shopifyVariantTitle?: string
  components: Array<{
    erpVariantId: string
    quantity: number
  }>
}) {
  try {
    // Validate: at least one component
    if (!data.components || data.components.length === 0) {
      return {
        success: false,
        error: "At least one component is required",
      }
    }

    // Delete existing mappings for this Shopify variant (to replace with new component set)
    await db
      .delete(shopifyVariantMappings)
      .where(eq(shopifyVariantMappings.shopifyVariantId, data.shopifyVariantId))

    // Create new mappings for each component
    const createdMappings = []
    for (const component of data.components) {
      // Validate each component variant
      const [componentVariant] = await db
        .select({
          id: productVariants.id,
          productType: products.type,
        })
        .from(productVariants)
        .leftJoin(products, eq(productVariants.productId, products.id))
        .where(eq(productVariants.id, component.erpVariantId))
        .limit(1)

      if (!componentVariant) {
        return {
          success: false,
          error: `Component variant ${component.erpVariantId} not found`,
        }
      }

      if (componentVariant.productType !== "FINAL") {
        return {
          success: false,
          error: "Only FINAL products can be mapped to Shopify",
        }
      }

      // Create mapping for this component
      const [created] = await db
        .insert(shopifyVariantMappings)
        .values({
          shopifyProductId: data.shopifyProductId,
          shopifyVariantId: data.shopifyVariantId,
          shopifyProductTitle: data.shopifyProductTitle,
          shopifyVariantTitle: data.shopifyVariantTitle,
          productVariantId: component.erpVariantId,
          quantity: component.quantity.toString(),
          syncStatus: "active",
          lastSyncedAt: new Date(),
        })
        .returning()

      createdMappings.push(created)
    }

    return {
      success: true,
      mappings: createdMappings,
      message: `Mapping created successfully with ${createdMappings.length} component(s)`,
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
 * Create property-based mapping for customizable products
 * Supports multiple ERP components per property rule set
 */
export async function createPropertyMapping(data: {
  shopifyProductId: string
  shopifyVariantId: string
  shopifyProductTitle?: string
  shopifyVariantTitle?: string
  propertyRules: Record<string, string>
  components: Array<{
    erpVariantId: string
    quantity: number
  }>
}) {
  try {
    // Validate: at least one component
    if (!data.components || data.components.length === 0) {
      return {
        success: false,
        error: "At least one component is required",
      }
    }

    // Delete existing property mappings with these rules for this Shopify variant
    // This allows updating/replacing the component set
    await db
      .delete(shopifyPropertyMappings)
      .where(
        and(
          eq(shopifyPropertyMappings.shopifyVariantId, data.shopifyVariantId),
          eq(shopifyPropertyMappings.propertyRules, data.propertyRules)
        )
      )

    // Create new mappings for each component
    const createdMappings = []
    for (const component of data.components) {
      // Validate each component variant
      const [erpVariant] = await db
        .select({
          id: productVariants.id,
          productType: products.type,
        })
        .from(productVariants)
        .leftJoin(products, eq(productVariants.productId, products.id))
        .where(eq(productVariants.id, component.erpVariantId))
        .limit(1)

      if (!erpVariant) {
        return {
          success: false,
          error: `Component variant ${component.erpVariantId} not found`,
        }
      }

      if (erpVariant.productType !== "FINAL") {
        return {
          success: false,
          error: "Only FINAL products can be mapped to Shopify",
        }
      }

      // Create mapping for this component
      const [created] = await db
        .insert(shopifyPropertyMappings)
        .values({
          shopifyProductId: data.shopifyProductId,
          shopifyVariantId: data.shopifyVariantId,
          shopifyProductTitle: data.shopifyProductTitle,
          shopifyVariantTitle: data.shopifyVariantTitle,
          propertyRules: data.propertyRules,
          productVariantId: component.erpVariantId,
          quantity: component.quantity.toString(),
          syncStatus: "active",
        })
        .returning()

      createdMappings.push(created)
    }

    return {
      success: true,
      mappings: createdMappings,
      message: `Property mapping created successfully with ${createdMappings.length} component(s)`,
    }
  } catch (error) {
    console.error("Error creating property mapping:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get all property mappings for a Shopify variant
 */
export async function getPropertyMappings(shopifyVariantId?: string) {
  try {
    const query = db
      .select({
        id: shopifyPropertyMappings.id,
        shopifyProductId: shopifyPropertyMappings.shopifyProductId,
        shopifyVariantId: shopifyPropertyMappings.shopifyVariantId,
        shopifyProductTitle: shopifyPropertyMappings.shopifyProductTitle,
        shopifyVariantTitle: shopifyPropertyMappings.shopifyVariantTitle,
        propertyRules: shopifyPropertyMappings.propertyRules,
        productVariantId: shopifyPropertyMappings.productVariantId,
        quantity: shopifyPropertyMappings.quantity,
        syncStatus: shopifyPropertyMappings.syncStatus,
        createdAt: shopifyPropertyMappings.createdAt,
        erpProductName: products.name,
        erpVariantSku: productVariants.sku,
      })
      .from(shopifyPropertyMappings)
      .leftJoin(
        productVariants,
        eq(shopifyPropertyMappings.productVariantId, productVariants.id)
      )
      .leftJoin(products, eq(productVariants.productId, products.id))

    const mappings = shopifyVariantId
      ? await query.where(
          eq(shopifyPropertyMappings.shopifyVariantId, shopifyVariantId)
        )
      : await query

    return {
      success: true,
      mappings,
      totalCount: mappings.length,
    }
  } catch (error) {
    console.error("Error fetching property mappings:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      mappings: [],
      totalCount: 0,
    }
  }
}

/**
 * Delete a property mapping
 */
export async function deletePropertyMapping(mappingId: string) {
  try {
    await db
      .delete(shopifyPropertyMappings)
      .where(eq(shopifyPropertyMappings.id, mappingId))

    return {
      success: true,
      message: "Property mapping deleted successfully",
    }
  } catch (error) {
    console.error("Error deleting property mapping:", error)
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
