import { z } from "zod"
import { COLORS } from "@/constants/colors"

export const colorEnum = z.enum(COLORS)

// Product form schema
export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(255, { message: "Name must be 255 characters or less" }),
  colors: z.array(colorEnum),
  materials: z.array(
    z.object({
      materialId: z.string().uuid(),
      quantityPerProduct: z.number().positive(),
    })
  ),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

// Material form schema
export const materialFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(255, { message: "Name must be 255 characters or less" }),
  unit: z
    .string()
    .trim()
    .min(1, { message: "Unit is required" })
    .max(32, { message: "Unit must be 32 characters or less" }),
})

export type MaterialFormValues = z.infer<typeof materialFormSchema>
