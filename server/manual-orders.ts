"use server"

import { db } from "@/db/drizzle"
import {
  manualOrders,
  manualOrderItems,
  productVariants,
  products,
  productVariantSelections,
  productVariations,
  productVariationOptions,
  inventory,
  inventoryMovements,
} from "@/db/schema"
import { eq, inArray, desc, sql } from "drizzle-orm"
import { inventoryActionEnum } from "@/constants/inventory-actions"
import { unstable_noStore as noStore } from "next/cache"

export type ManualOrderLineItem = {
  id: string
  productVariantId: string
  productId: string
  productName: string
  variantLabel: string
  sku: string
  quantity: string
}

export type ManualOrderWithItems = {
  id: string
  name: string
  orderNumber: string
  reason: string | null
  createdBy: string | null
  status: "open" | "fulfilled"
  processedAt: Date | null
  createdAt: Date
  updatedAt: Date
  lineItems: ManualOrderLineItem[]
}

export async function getManualOrders(filter?: "open" | "fulfilled") {
  noStore()
  try {
    const baseQuery = db
      .select()
      .from(manualOrders)
      .orderBy(desc(manualOrders.createdAt))
    const orders = filter
      ? await baseQuery.where(eq(manualOrders.status, filter))
      : await baseQuery

    if (orders.length === 0) {
      return { success: true as const, data: [] }
    }

    const orderIds = orders.map((o) => o.id)
    const items = await db
      .select({
        id: manualOrderItems.id,
        orderId: manualOrderItems.orderId,
        productVariantId: manualOrderItems.productVariantId,
        quantity: manualOrderItems.quantity,
        productId: products.id,
        productName: products.name,
        sku: productVariants.sku,
      })
      .from(manualOrderItems)
      .innerJoin(
        productVariants,
        eq(productVariants.id, manualOrderItems.productVariantId)
      )
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(manualOrderItems.orderId, orderIds))

    const variantIds = [...new Set(items.map((i) => i.productVariantId))]
    const selectionsMap = new Map<
      string,
      Array<{ variationName: string; optionValue: string }>
    >()

    if (variantIds.length > 0) {
      const selections = await db
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
        .where(inArray(productVariantSelections.variantId, variantIds))

      for (const s of selections) {
        if (!selectionsMap.has(s.variantId)) {
          selectionsMap.set(s.variantId, [])
        }
        selectionsMap.get(s.variantId)!.push({
          variationName: s.variationName,
          optionValue: s.optionValue,
        })
      }
    }

    const itemsByOrder = new Map<string, ManualOrderLineItem[]>()
    for (const row of items) {
      const variantLabel = (selectionsMap.get(row.productVariantId) || [])
        .map((s) => `${s.variationName}: ${s.optionValue}`)
        .join(", ")
      const item: ManualOrderLineItem = {
        id: row.id,
        productVariantId: row.productVariantId,
        productId: row.productId,
        productName: row.productName,
        variantLabel: variantLabel || "–",
        sku: row.sku,
        quantity: String(row.quantity),
      }
      if (!itemsByOrder.has(row.orderId)) {
        itemsByOrder.set(row.orderId, [])
      }
      itemsByOrder.get(row.orderId)!.push(item)
    }

    const data: ManualOrderWithItems[] = orders.map((o) => ({
      id: o.id,
      name: o.name,
      orderNumber: o.orderNumber,
      reason: o.reason,
      createdBy: o.createdBy,
      status: o.status as "open" | "fulfilled",
      processedAt: o.processedAt,
      createdAt: o.createdAt!,
      updatedAt: o.updatedAt!,
      lineItems: itemsByOrder.get(o.id) || [],
    }))

    return { success: true as const, data }
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Fehler beim Laden der manuellen Aufträge",
      data: [],
    }
  }
}

export type CreateManualOrderParams = {
  name: string
  orderNumber: string
  reason: string
  createdBy: string
  items: Array<{ productVariantId: string; quantity: number }>
}

export async function createManualOrder(params: CreateManualOrderParams) {
  try {
    if (!params.items.length) {
      return { success: false, message: "Mindestens ein Produkt erforderlich." }
    }

    const [order] = await db
      .insert(manualOrders)
      .values({
        name: params.name.trim(),
        orderNumber: params.orderNumber.trim(),
        reason: params.reason.trim() || null,
        createdBy: params.createdBy.trim() || null,
        status: "open",
      })
      .returning()

    if (!order) {
      return { success: false, message: "Auftrag konnte nicht angelegt werden." }
    }

    await db.insert(manualOrderItems).values(
      params.items.map((item) => ({
        orderId: order.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity.toString(),
      }))
    )

    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Fehler beim Anlegen des Auftrags",
    }
  }
}

export type UpdateManualOrderParams = {
  name: string
  orderNumber: string
  reason: string
  createdBy: string
  items: Array<{ productVariantId: string; quantity: number }>
}

export async function updateManualOrder(
  orderId: string,
  params: UpdateManualOrderParams
) {
  try {
    if (!params.items.length) {
      return { success: false, message: "Mindestens ein Produkt erforderlich." }
    }

    const [existing] = await db
      .select()
      .from(manualOrders)
      .where(eq(manualOrders.id, orderId))
      .limit(1)

    if (!existing) {
      return { success: false, message: "Auftrag nicht gefunden." }
    }

    if (existing.status === "fulfilled") {
      return {
        success: false,
        message: "Erfüllte Aufträge können nicht bearbeitet werden.",
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(manualOrders)
        .set({
          name: params.name.trim(),
          orderNumber: params.orderNumber.trim(),
          reason: params.reason.trim() || null,
          createdBy: params.createdBy.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(manualOrders.id, orderId))

      await tx
        .delete(manualOrderItems)
        .where(eq(manualOrderItems.orderId, orderId))

      await tx.insert(manualOrderItems).values(
        params.items.map((item) => ({
          orderId,
          productVariantId: item.productVariantId,
          quantity: item.quantity.toString(),
        }))
      )
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Fehler beim Speichern.",
    }
  }
}

/**
 * Set manual order to fulfilled and deduct stock (same logic as Shopify order processing).
 */
export async function setManualOrderFulfilled(orderId: string) {
  try {
    const [order] = await db
      .select()
      .from(manualOrders)
      .where(eq(manualOrders.id, orderId))
      .limit(1)

    if (!order) {
      return { success: false, message: "Auftrag nicht gefunden." }
    }

    if (order.status === "fulfilled") {
      return { success: false, message: "Auftrag ist bereits erfüllt." }
    }

    const items = await db
      .select({
        productVariantId: manualOrderItems.productVariantId,
        quantity: manualOrderItems.quantity,
        productId: productVariants.productId,
      })
      .from(manualOrderItems)
      .innerJoin(
        productVariants,
        eq(productVariants.id, manualOrderItems.productVariantId)
      )
      .where(eq(manualOrderItems.orderId, orderId))

    if (items.length === 0) {
      return { success: false, message: "Auftrag hat keine Positionen." }
    }

    // Aggregate by variant (same as processShopifyOrder)
    const aggregation = new Map<
      string,
      { productId: string; totalQty: number }
    >()
    for (const item of items) {
      const existing = aggregation.get(item.productVariantId)
      const qty = Number(item.quantity)
      if (existing) {
        existing.totalQty += qty
      } else {
        aggregation.set(item.productVariantId, {
          productId: item.productId,
          totalQty: qty,
        })
      }
    }

    await db.transaction(async (tx) => {
      for (const [variantId, { productId, totalQty }] of aggregation.entries()) {
        await tx.insert(inventoryMovements).values({
          productId,
          variantId,
          quantity: (-totalQty).toString(),
          action: inventoryActionEnum.enum.SALE,
        })

        // Upsert: handles missing inventory rows gracefully
        await tx
          .insert(inventory)
          .values({
            productId,
            variantId,
            quantityOnHand: (-totalQty).toString(),
          })
          .onConflictDoUpdate({
            target: inventory.variantId,
            set: {
              quantityOnHand: sql`${inventory.quantityOnHand} - ${totalQty}`,
            },
          })
      }

      await tx
        .update(manualOrders)
        .set({
          status: "fulfilled",
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(manualOrders.id, orderId))
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Fehler beim Erfüllen des Auftrags",
    }
  }
}
