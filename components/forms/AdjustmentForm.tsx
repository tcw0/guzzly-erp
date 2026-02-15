"use client"

import React from "react"
import { z } from "zod"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { adjustmentFormSchema } from "@/lib/validation"
import { createAdjustment } from "@/server/adjustment"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Product } from "@/db/schema"
import { getProducts, getProductWithVariations, getProductVariants } from "@/server/product"

type ProductVariations = {
  productId: string
  variations: Array<{
    variation: { id: string; name: string }
    options: Array<{ id: string; value: string }>
  }>
  variants: Array<{
    variant: { id: string }
    selections: Array<{
      variationId: string
      optionId: string
      variationName: string
      optionValue: string
    }>
  }>
}

export default function AdjustmentForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [availableProducts, setAvailableProducts] = React.useState<Product[]>([])
  const [productVariationsMap, setProductVariationsMap] = React.useState<
    Map<string, ProductVariations>
  >(new Map())

  const loadProducts = React.useCallback(async () => {
    const result = await getProducts()
    if (result.success && result.data) {
      setAvailableProducts(result.data)
    }
  }, [])

  React.useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const form = useForm<z.infer<typeof adjustmentFormSchema>>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: {
      createdBy: "",
      adjustments: [{ productId: "", direction: "decrease", quantity: 0, reason: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "adjustments",
  })

  // Load product variations when product is selected
  const handleProductChange = React.useCallback(
    async (productId: string, index: number) => {
      if (!productId) {
        form.setValue(`adjustments.${index}.variantId`, undefined)
        return
      }

      const productData = await getProductWithVariations(productId)
      const variantsData = await getProductVariants(productId)

      if (productData.success && productData.data && variantsData.success && variantsData.data) {
        setProductVariationsMap((prev) => {
          const newMap = new Map(prev)
          newMap.set(productId, {
            productId,
            variations: productData.data.variations,
            variants: variantsData.data,
          })
          return newMap
        })

        // If no variations, auto-select default variant
        if (productData.data.variations.length === 0 && variantsData.data.length > 0) {
          form.setValue(`adjustments.${index}.variantId`, variantsData.data[0].variant.id)
        } else {
          form.setValue(`adjustments.${index}.variantId`, undefined)
        }
      }
    },
    [form]
  )

  // Find variantId based on selected optionIds
  const findVariantId = React.useCallback(
    (productId: string, selectedOptionIds: Record<string, string>): string | undefined => {
      const productData = productVariationsMap.get(productId)
      if (!productData) return undefined

      // Find variant that matches all selected options
      return productData.variants.find((v) => {
        const variantSelections = new Map(
          v.selections.map((s) => [s.variationId, s.optionId])
        )
        
        // Check if all selected options match this variant
        return Object.entries(selectedOptionIds).every(
          ([variationId, optionId]) => variantSelections.get(variationId) === optionId
        )
      })?.variant.id
    },
    [productVariationsMap]
  )

  async function onSubmit(values: z.infer<typeof adjustmentFormSchema>) {
    setIsLoading(true)
    const result = await createAdjustment(values)

    if (result.success) {
      toast.success("Inventory adjustment recorded successfully")
      await loadProducts()
      form.reset({ createdBy: "", adjustments: [{ productId: "", direction: "decrease", quantity: 0, reason: "" }] })
      setProductVariationsMap(new Map())
    } else {
      toast.error("message" in result ? result.message : "An error occurred")
    }

    setIsLoading(false)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="createdBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ersteller Adjustment</FormLabel>
              <FormControl>
                <Input placeholder="Name des Erstellers" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="adjustments"
          render={() => (
            <FormItem>
              <FormLabel>Inventory Adjustments</FormLabel>
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const productId = form.watch(`adjustments.${index}.productId`)
                  const productData = productId ? productVariationsMap.get(productId) : null
                  const hasVariations = productData && productData.variations.length > 0

                  return (
                    <div key={field.id} className="space-y-3 rounded-md border p-4">
                      <div className="flex items-end gap-4">
                        <FormField
                          control={form.control}
                          name={`adjustments.${index}.productId`}
                          render={({ field }) => (
                            <FormItem className="flex-[1_1_0%] min-w-0 overflow-hidden">
                              <FormLabel className="sr-only">Product</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={(value) => {
                                  field.onChange(value)
                                  handleProductChange(value, index)
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="truncate w-full">
                                    <SelectValue placeholder="Select product" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="z-60">
                                  {availableProducts.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} ({p.unit})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`adjustments.${index}.direction`}
                          render={({ field }) => (
                            <FormItem className="w-28 min-w-28 shrink-0">
                              <FormLabel className="sr-only">Direction</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="increase">Increase</SelectItem>
                                  <SelectItem value="decrease">Decrease</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`adjustments.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem className="w-16 min-w-16 shrink-0">
                              <FormLabel className="sr-only">Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="Quantity"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            remove(index)
                            if (productId) {
                              const newMap = new Map(productVariationsMap)
                              newMap.delete(productId)
                              setProductVariationsMap(newMap)
                            }
                          }}
                          className="shrink-0"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      {hasVariations && productData && (
                        <div className="space-y-2">
                          {productData.variations.map((variationData) => {
                            const variationId = variationData.variation.id
                            return (
                              <FormField
                                key={variationId}
                                control={form.control}
                                name={`adjustments.${index}.variation_${variationId}` as any}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel className="text-sm">
                                      {variationData.variation.name}
                                    </FormLabel>
                                    <Select
                                      value={field.value || ""}
                                      onValueChange={(value) => {
                                        field.onChange(value)
                                        const allSelections: Record<string, string> = {}
                                        productData.variations.forEach((v) => {
                                          const val = form.getValues(
                                            `adjustments.${index}.variation_${v.variation.id}` as any
                                          )
                                          if (val) {
                                            allSelections[v.variation.id] = val
                                          }
                                        })
                                        allSelections[variationId] = value
                                        if (Object.keys(allSelections).length === productData.variations.length) {
                                          const variantId = findVariantId(productId, allSelections)
                                          if (variantId) {
                                            form.setValue(`adjustments.${index}.variantId`, variantId)
                                          }
                                        }
                                      }}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder={`Select ${variationData.variation.name}`} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {variationData.options.map((opt) => (
                                          <SelectItem key={opt.id} value={opt.id}>
                                            {opt.value}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )
                          })}
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name={`adjustments.${index}.reason`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Reason (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Reason for adjustment" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`adjustments.${index}.variantId`}
                        render={({ field }) => (
                          <FormItem className="hidden">
                            <FormControl>
                              <Input type="hidden" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => append({ productId: "", direction: "decrease", quantity: 0, reason: "" })}
                >
                  <Plus className="size-4 mr-2" />
                  Add Adjustment
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button disabled={isLoading} type="submit" className="w-full">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Record Adjustments"
          )}
        </Button>
      </form>
    </Form>
  )
}
