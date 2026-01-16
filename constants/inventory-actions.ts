import { z } from "zod"

export const INVENTORY_ACTIONS = [
  "PURCHASE",
  "OUTPUT",
  "CONSUMPTION",
  "ADJUSTMENT",
  "SALE"
] as const

export const inventoryActionEnum = z.enum(INVENTORY_ACTIONS)
