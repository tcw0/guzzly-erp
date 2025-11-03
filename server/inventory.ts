"use server"

import { db } from "@/db/drizzle"
import { products, inventory } from "@/db/schema"
import { eq } from "drizzle-orm"

export type InventoryItem = {
  id: string
  name: string
  type: "RAW" | "INTERMEDIATE" | "FINAL"
  unit: string
  quantityOnHand: string
}

export async function getInventory() {
  try {
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        type: products.type,
        unit: products.unit,
        quantityOnHand: inventory.quantityOnHand,
      })
      .from(products)
      .leftJoin(inventory, eq(inventory.productId, products.id))

    const data: InventoryItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as InventoryItem["type"],
      unit: r.unit,
      quantityOnHand: (r.quantityOnHand ?? "0").toString(),
    }))

    return { success: true as const, data }
  } catch (error) {
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "An error occurred",
    }
  }
}


