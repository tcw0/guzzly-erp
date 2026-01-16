"use server"
import { db } from "@/db/drizzle"
import {
  products,
  productVariants,
  variantBillOfMaterials,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

type ComponentRow = {
  productId: string
  productName: string
  productType: string
  variantId: string
  variantSku: string
  componentProductId: string
  componentProductName: string
  componentVariantId: string
  componentVariantSku: string
  quantityRequired: string
}

export type ProductComponentRelations = Array<{
  product: {
    id: string
    name: string
    type: string
  }
  variants: Array<{
    id: string
    sku: string
    components: Array<{
      productId: string
      productName: string
      variantId: string
      variantSku: string
      quantityRequired: string
    }>
  }>
}>

export async function getProductComponentRelations(): Promise<{
  success: boolean
  data?: ProductComponentRelations
  message?: string
}> {
  try {
    const componentVariants = alias(productVariants, "componentVariants")
    const componentProducts = alias(products, "componentProducts")

    const rows = await db
      .select({
        productId: products.id,
        productName: products.name,
        productType: products.type,
        variantId: productVariants.id,
        variantSku: productVariants.sku,
        componentProductId: componentProducts.id,
        componentProductName: componentProducts.name,
        componentVariantId: componentVariants.id,
        componentVariantSku: componentVariants.sku,
        quantityRequired: variantBillOfMaterials.quantityRequired,
      })
      .from(variantBillOfMaterials)
      .innerJoin(
        productVariants,
        eq(productVariants.id, variantBillOfMaterials.productVariantId)
      )
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(
        componentVariants,
        eq(componentVariants.id, variantBillOfMaterials.componentVariantId)
      )
      .innerJoin(
        componentProducts,
        eq(componentProducts.id, componentVariants.productId)
      )

    // Group rows into product → variant → components structure
    const productMap = new Map<string, {
      product: { id: string; name: string; type: string }
      variants: Map<string, { id: string; sku: string; components: Array<{
        productId: string
        productName: string
        variantId: string
        variantSku: string
        quantityRequired: string
      }> }>
    }>()

    for (const r of rows as ComponentRow[]) {
      if (!productMap.has(r.productId)) {
        productMap.set(r.productId, {
          product: { id: r.productId, name: r.productName, type: r.productType },
          variants: new Map(),
        })
      }

      const p = productMap.get(r.productId)!
      if (!p.variants.has(r.variantId)) {
        p.variants.set(r.variantId, {
          id: r.variantId,
          sku: r.variantSku,
          components: [],
        })
      }

      p.variants.get(r.variantId)!.components.push({
        productId: r.componentProductId,
        productName: r.componentProductName,
        variantId: r.componentVariantId,
        variantSku: r.componentVariantSku,
        quantityRequired: r.quantityRequired,
      })
    }

    const data: ProductComponentRelations = Array.from(productMap.values()).map(
      (entry) => ({
        product: entry.product,
        variants: Array.from(entry.variants.values()),
      })
    )

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch BOM relations",
    }
  }
}
