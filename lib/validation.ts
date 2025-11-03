import { z } from "zod"
import { COLORS } from "@/constants/colors"
import { productTypeEnum } from "@/constants/product-types"

export const colorEnum = z.enum(COLORS)

// Product form schema
export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(255, { message: "Name must be 255 characters or less" }),
  type: productTypeEnum,
  unit: z
    .string()
    .trim()
    .min(1, { message: "Unit is required" })
    .max(32, { message: "Unit must be 32 characters or less" }),
  components: z.array(
    z.object({
      componentId: z.string().uuid(),
      quantityRequired: z.number().positive(),
    })
  ),
})

export type ProductFormValues = z.infer<typeof productFormSchema>
export type ProductParams = ProductFormValues

// Output form schema
export const outputFormSchema = z.object({
  outputs: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
      })
    )
    .min(1, { message: "At least one product output is required" }),
})

export type OutputFormValues = z.infer<typeof outputFormSchema>
export type OutputParams = OutputFormValues

// Purchase form schema
export const purchaseFormSchema = z.object({
  purchases: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
      })
    )
    .min(1, { message: "At least one product purchase is required" }),
})

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>
export type PurchaseParams = PurchaseFormValues
