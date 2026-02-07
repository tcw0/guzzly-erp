"use client"

import React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import { z } from "zod"
import { Product } from "@/db/schema"

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
import { outputFormSchema } from "@/lib/validation"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { getFinishedProducts, getProductWithVariations, getProductVariants } from "@/server/product"
import { createOutput } from "@/server/output"

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

export default function OutputForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [availableProducts, setAvailableProducts] = React.useState<Product[]>(
    []
  )
  const [productVariationsMap, setProductVariationsMap] = React.useState<
    Map<string, ProductVariations>
  >(new Map())

  React.useEffect(() => {
    const loadProducts = async () => {
      const result = await getFinishedProducts()
      if (result.success && result.data) {
        setAvailableProducts(result.data)
      }
    }
    loadProducts()
  }, [])

  const form = useForm<z.infer<typeof outputFormSchema>>({
    resolver: zodResolver(outputFormSchema),
    defaultValues: {
      createdBy: "",
      outputs: [{ productId: "", quantity: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "outputs",
  })

  // Load product variations when product is selected
  const handleProductChange = React.useCallback(
    async (productId: string, index: number) => {
      if (!productId) {
        form.setValue(`outputs.${index}.variantId`, undefined)
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
          form.setValue(`outputs.${index}.variantId`, variantsData.data[0].variant.id)
        } else {
          form.setValue(`outputs.${index}.variantId`, undefined)
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

  async function onSubmit(values: z.infer<typeof outputFormSchema>) {
    setIsLoading(true)
    const result = await createOutput(values)

    if (result.success) {
      toast.success("Production output recorded successfully")
      form.reset({
        createdBy: "",
        outputs: [{ productId: "", quantity: 0 }],
      })
      setProductVariationsMap(new Map())
    } else if (!result.success && "message" in result) {
      toast.error(result.message)
    } else {
      toast.error("An error occurred while recording production")
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
              <FormLabel>Ersteller Output</FormLabel>
              <FormControl>
                <Input placeholder="Name des Erstellers" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="outputs"
          render={() => (
            <FormItem>
              <FormLabel>Production Outputs</FormLabel>
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const productId = form.watch(`outputs.${index}.productId`)
                  const productData = productId ? productVariationsMap.get(productId) : null
                  const hasVariations = productData && productData.variations.length > 0

                  return (
                    <div key={field.id} className="space-y-3 rounded-md border p-4">
                      <div className="flex items-end gap-4">
                        <FormField
                          control={form.control}
                          name={`outputs.${index}.productId`}
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
                                <SelectContent>
                                  {availableProducts.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.name} ({product.unit})
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
                          name={`outputs.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem className="w-16 min-w-16 shrink-0">
                              <FormLabel className="sr-only">Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="Quantity"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(parseFloat(e.target.value) || 0)
                                  }
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

                      {/* Variation selectors */}
                      {hasVariations && productData && (
                        <div className="space-y-2">
                          {productData.variations.map((variationData) => {
                            const variationId = variationData.variation.id

                            return (
                              <FormField
                                key={variationId}
                                control={form.control}
                                name={
                                  `outputs.${index}.variation_${variationId}` as any
                                }
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel className="text-sm">
                                      {variationData.variation.name}
                                    </FormLabel>
                                    <Select
                                      value={field.value || ""}
                                      onValueChange={(value) => {
                                        field.onChange(value)
                                        // Update all selected options and find matching variant
                                        const allSelections: Record<string, string> = {}
                                        productData.variations.forEach((v) => {
                                          const val = form.getValues(
                                            `outputs.${index}.variation_${v.variation.id}` as any
                                          )
                                          if (val) {
                                            allSelections[v.variation.id] = val
                                          }
                                        })
                                        allSelections[variationId] = value

                                        // Check if we have all selections
                                        if (
                                          Object.keys(allSelections).length ===
                                          productData.variations.length
                                        ) {
                                          const variantId = findVariantId(
                                            productId,
                                            allSelections
                                          )
                                          if (variantId) {
                                            form.setValue(
                                              `outputs.${index}.variantId`,
                                              variantId
                                            )
                                          }
                                        }
                                      }}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue
                                            placeholder={`Select ${variationData.variation.name}`}
                                          />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {variationData.options.map((option) => (
                                          <SelectItem key={option.id} value={option.id}>
                                            {option.value}
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

                      {/* Hidden variantId field */}
                      <FormField
                        control={form.control}
                        name={`outputs.${index}.variantId`}
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
                  onClick={() => append({ productId: "", quantity: 0 })}
                >
                  <Plus className="size-4 mr-2" />
                  Add Product
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button disabled={isLoading} type="submit">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Record Production"
          )}
        </Button>
      </form>
    </Form>
  )
}
