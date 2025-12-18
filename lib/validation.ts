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
  minimumStockLevel: z
    .number()
    .min(0, { message: "Minimum stock level must be 0 or greater" })
    .default(0),
  components: z.array(
    z.object({
      componentId: z.string().uuid(),
      quantityRequired: z
        .number()
        .positive(),
      // Variant mapping rules: maps component variation names to product variation names
      // Strategy can be: "mapped" (explicit mapping to product variation), or "default" (fixed value)
      variantMappingRules: z
        .array(
          z.object({
            componentVariationName: z.string().min(1),
            strategy: z.enum(["mapped", "default"]),
            productVariationName: z.string().optional(), // Used when strategy is "mapped"
            defaultOptionValue: z.string().optional(), // Used when strategy is "default"
          })
          .refine(
            (data) => {
              // When strategy is "mapped", productVariationName must be provided
              if (data.strategy === "mapped") {
                return !!data.productVariationName
              }
              // When strategy is "default", defaultOptionValue must be provided
              if (data.strategy === "default") {
                return !!data.defaultOptionValue
              }
              return true
            },
            {
              message: "Please select a value for the chosen mapping strategy",
            }
          )
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
        quantity: z
          .number()
          .positive(),
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
        quantity: z
          .number()
          .positive(),
      })
    )
    .min(1, { message: "At least one product purchase is required" }),
})

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>
export type PurchaseParams = PurchaseFormValues

// Shopify variant mapping schema - supports multiple components
export const shopifyComponentMappingSchema = z.object({
  erpVariantId: z.string().uuid({ message: "Please select a valid ERP product" }),
  quantity: z.coerce.number().positive({ message: "Quantity must be positive" }).default(1),
})

export const shopifyMappingSchema = z.object({
  shopifyProductId: z.string().min(1, { message: "Shopify product ID is required" }),
  shopifyVariantId: z.string().min(1, { message: "Shopify variant ID is required" }),
  components: z.array(shopifyComponentMappingSchema).min(1, { message: "At least one component is required" }),
})

export type ShopifyComponentMapping = z.infer<typeof shopifyComponentMappingSchema>
export type ShopifyMappingFormValues = z.infer<typeof shopifyMappingSchema>
