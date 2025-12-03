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
      // Variant mapping rules: maps component variation names to product variation names
      // If a component variation name matches a product variation name, they are automatically matched
      // If a component variation doesn't match, specify a default option value
      variantMappingRules: z
        .array(
          z.object({
            componentVariationName: z.string().min(1),
            productVariationName: z.string().optional(), // If provided, match this product variation
            defaultOptionValue: z.string().optional(), // If provided, use this option for all product variants
          })
        )
        .optional(),
    })
  ),
  variations: z.array(
    z.object({
      name: z
        .string()
        .trim()
        .min(1, { message: "Variation name is required" })
        .max(255, { message: "Variation name must be 255 characters or less" }),
      options: z
        .array(
          z
            .string()
            .trim()
            .min(1, { message: "Option cannot be empty" })
            .max(255, { message: "Option must be 255 characters or less" })
        )
        .min(1, { message: "At least one option is required" }),
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
        variantId: z.string().uuid().optional(), // Optional for backward compatibility, but required when product has variations
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
        variantId: z.string().uuid().optional(), // Optional for backward compatibility, but required when product has variations
        quantity: z.number().positive(),
      })
    )
    .min(1, { message: "At least one product purchase is required" }),
})

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>
export type PurchaseParams = PurchaseFormValues
