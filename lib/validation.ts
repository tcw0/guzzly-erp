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
