import { z } from "zod"

export const PRODUCT_TYPES = ["RAW", "INTERMEDIATE", "FINAL"] as const
export const productTypeEnum = z.enum(PRODUCT_TYPES)
