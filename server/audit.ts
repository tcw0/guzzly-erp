"use server"

import { db } from "@/db/drizzle"
import {
  shopifyVariantMappings,
  shopifyPropertyMappings,
  productVariants,
  productVariantSelections,
  productVariations,
  productVariationOptions,
  products,
  variantBillOfMaterials,
} from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { unstable_noStore as noStore } from "next/cache"

// ── Types ──

export type ShopifyMappingAuditRow = {
  mappingId: string
  shopifyProductTitle: string | null
  shopifyVariantTitle: string | null
  shopifyVariantId: string
  erpProductName: string
  erpSku: string
  erpVariantSelections: string // e.g. "Farbe=Rot"
  quantity: string
  status: "ok" | "mismatch" | "warning"
  note: string
}

export type BomAuditRow = {
  bomId: string
  productName: string
  productSku: string
  productSelections: string // e.g. "Farbe=Rot"
  componentName: string
  componentSku: string
  componentSelections: string
  quantityRequired: string
  status: "ok" | "mismatch" | "warning"
  note: string
}

export type AuditResult = {
  success: boolean
  shopifyMappings: ShopifyMappingAuditRow[]
  propertyMappings: ShopifyMappingAuditRow[]
  bomEntries: BomAuditRow[]
  message?: string
}

// ── Helpers ──

/** Load all variant selections into a map: variantId → [{variationName, optionValue}] */
async function loadSelectionsMap(): Promise<
  Map<string, Array<{ variationName: string; optionValue: string }>>
> {
  const all = await db
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

  const map = new Map<
    string,
    Array<{ variationName: string; optionValue: string }>
  >()
  for (const row of all) {
    if (!map.has(row.variantId)) map.set(row.variantId, [])
    map.get(row.variantId)!.push({
      variationName: row.variationName,
      optionValue: row.optionValue,
    })
  }
  return map
}

function formatSelections(
  sels: Array<{ variationName: string; optionValue: string }> | undefined
): string {
  if (!sels || sels.length === 0) return "(keine)"
  return sels.map((s) => `${s.variationName}=${s.optionValue}`).join(", ")
}

/** Extract color value from selections (case-insensitive key match) */
function getColor(
  sels: Array<{ variationName: string; optionValue: string }> | undefined
): string | null {
  if (!sels) return null
  const c = sels.find(
    (s) => s.variationName.toLowerCase() === "farbe" || s.variationName.toLowerCase() === "color"
  )
  return c?.optionValue ?? null
}

// ── Main Audit ──

export async function runInventoryAudit(): Promise<AuditResult> {
  noStore()
  try {
    const selectionsMap = await loadSelectionsMap()

    // ── 1. Shopify Variant Mappings ──
    const variantMappings = await db
      .select({
        mappingId: shopifyVariantMappings.id,
        shopifyProductTitle: shopifyVariantMappings.shopifyProductTitle,
        shopifyVariantTitle: shopifyVariantMappings.shopifyVariantTitle,
        shopifyVariantId: shopifyVariantMappings.shopifyVariantId,
        erpVariantId: shopifyVariantMappings.productVariantId,
        quantity: shopifyVariantMappings.quantity,
        syncStatus: shopifyVariantMappings.syncStatus,
        erpSku: productVariants.sku,
        erpProductName: products.name,
      })
      .from(shopifyVariantMappings)
      .innerJoin(
        productVariants,
        eq(productVariants.id, shopifyVariantMappings.productVariantId)
      )
      .innerJoin(products, eq(products.id, productVariants.productId))

    const shopifyRows: ShopifyMappingAuditRow[] = variantMappings.map((m) => {
      const erpSels = selectionsMap.get(m.erpVariantId)
      const erpColor = getColor(erpSels)
      const shopifyTitle = (m.shopifyVariantTitle || "").toLowerCase()

      let status: "ok" | "mismatch" | "warning" = "ok"
      let note = ""

      // Check if Shopify variant title contains a color that differs from ERP color
      if (erpColor && shopifyTitle) {
        const erpColorLower = erpColor.toLowerCase()
        // If Shopify title doesn't contain the ERP color, flag as potential mismatch
        if (!shopifyTitle.includes(erpColorLower)) {
          status = "mismatch"
          note = `Shopify Variante "${m.shopifyVariantTitle}" enthält nicht die ERP-Farbe "${erpColor}"`
        }
      }

      if (m.syncStatus !== "active") {
        status = "warning"
        note = `Mapping ist ${m.syncStatus}`
      }

      return {
        mappingId: m.mappingId,
        shopifyProductTitle: m.shopifyProductTitle,
        shopifyVariantTitle: m.shopifyVariantTitle,
        shopifyVariantId: m.shopifyVariantId,
        erpProductName: m.erpProductName ?? "",
        erpSku: m.erpSku ?? "",
        erpVariantSelections: formatSelections(erpSels),
        quantity: String(m.quantity),
        status,
        note,
      }
    })

    // ── 2. Shopify Property Mappings ──
    const propMappings = await db
      .select({
        mappingId: shopifyPropertyMappings.id,
        shopifyProductTitle: shopifyPropertyMappings.shopifyProductTitle,
        shopifyVariantTitle: shopifyPropertyMappings.shopifyVariantTitle,
        shopifyVariantId: shopifyPropertyMappings.shopifyVariantId,
        propertyRules: shopifyPropertyMappings.propertyRules,
        erpVariantId: shopifyPropertyMappings.productVariantId,
        quantity: shopifyPropertyMappings.quantity,
        syncStatus: shopifyPropertyMappings.syncStatus,
        erpSku: productVariants.sku,
        erpProductName: products.name,
      })
      .from(shopifyPropertyMappings)
      .innerJoin(
        productVariants,
        eq(productVariants.id, shopifyPropertyMappings.productVariantId)
      )
      .innerJoin(products, eq(products.id, productVariants.productId))

    const propertyRows: ShopifyMappingAuditRow[] = propMappings.map((m) => {
      const erpSels = selectionsMap.get(m.erpVariantId)
      const erpColor = getColor(erpSels)
      const rules = m.propertyRules as Record<string, string>

      let status: "ok" | "mismatch" | "warning" = "ok"
      let note = ""

      // Check if any property rule value matches/contains the ERP color
      if (erpColor) {
        const erpColorLower = erpColor.toLowerCase()
        const ruleValues = Object.values(rules).map((v) => v.toLowerCase())
        const colorInRules = ruleValues.some(
          (v) => v.includes(erpColorLower) || erpColorLower.includes(v)
        )
        if (!colorInRules) {
          status = "mismatch"
          note = `Property-Rules ${JSON.stringify(rules)} passen nicht zur ERP-Farbe "${erpColor}"`
        }
      }

      if (m.syncStatus !== "active") {
        status = "warning"
        note = `Mapping ist ${m.syncStatus}`
      }

      return {
        mappingId: m.mappingId,
        shopifyProductTitle: m.shopifyProductTitle,
        shopifyVariantTitle: `Rules: ${JSON.stringify(rules)}`,
        shopifyVariantId: m.shopifyVariantId,
        erpProductName: m.erpProductName ?? "",
        erpSku: m.erpSku ?? "",
        erpVariantSelections: formatSelections(erpSels),
        quantity: String(m.quantity),
        status,
        note,
      }
    })

    // ── 3. BOM Audit ──
    const bomRows = await db
      .select({
        bomId: variantBillOfMaterials.id,
        productVariantId: variantBillOfMaterials.productVariantId,
        componentVariantId: variantBillOfMaterials.componentVariantId,
        quantityRequired: variantBillOfMaterials.quantityRequired,
      })
      .from(variantBillOfMaterials)

    // Load product info for all involved variant IDs
    const allVariantIds = [
      ...new Set([
        ...bomRows.map((b) => b.productVariantId),
        ...bomRows.map((b) => b.componentVariantId),
      ]),
    ]

    const variantInfoMap = new Map<
      string,
      { productName: string; sku: string }
    >()
    if (allVariantIds.length > 0) {
      const variantInfo = await db
        .select({
          variantId: productVariants.id,
          productName: products.name,
          sku: productVariants.sku,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, allVariantIds))

      for (const v of variantInfo) {
        variantInfoMap.set(v.variantId, {
          productName: v.productName,
          sku: v.sku,
        })
      }
    }

    const bomAuditRows: BomAuditRow[] = bomRows.map((b) => {
      const productSels = selectionsMap.get(b.productVariantId)
      const componentSels = selectionsMap.get(b.componentVariantId)
      const productColor = getColor(productSels)
      const componentColor = getColor(componentSels)
      const productInfo = variantInfoMap.get(b.productVariantId)
      const componentInfo = variantInfoMap.get(b.componentVariantId)

      let status: "ok" | "mismatch" | "warning" = "ok"
      let note = ""

      // Check color match between product variant and component variant
      if (productColor && componentColor) {
        if (productColor.toLowerCase() !== componentColor.toLowerCase()) {
          status = "mismatch"
          note = `Produkt-Farbe "${productColor}" ≠ Komponenten-Farbe "${componentColor}"`
        }
      } else if (productColor && !componentColor) {
        // Product has color but component doesn't – might be ok (e.g., screws)
        status = "ok"
        note = "Komponente hat keine Farbe (evtl. korrekt)"
      }

      // Self-reference check
      if (b.productVariantId === b.componentVariantId) {
        status = "mismatch"
        note = "Selbstreferenz: Produkt = Komponente!"
      }

      return {
        bomId: b.bomId,
        productName: productInfo?.productName ?? "?",
        productSku: productInfo?.sku ?? "?",
        productSelections: formatSelections(productSels),
        componentName: componentInfo?.productName ?? "?",
        componentSku: componentInfo?.sku ?? "?",
        componentSelections: formatSelections(componentSels),
        quantityRequired: String(b.quantityRequired),
        status,
        note,
      }
    })

    return {
      success: true,
      shopifyMappings: shopifyRows,
      propertyMappings: propertyRows,
      bomEntries: bomAuditRows,
    }
  } catch (error) {
    return {
      success: false,
      shopifyMappings: [],
      propertyMappings: [],
      bomEntries: [],
      message:
        error instanceof Error ? error.message : "Unbekannter Fehler beim Audit",
    }
  }
}
