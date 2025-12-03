"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import { z } from "zod"

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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { productFormSchema } from "@/lib/validation"
import { createProduct } from "@/server/product"
import { getProducts, getProductWithVariations } from "@/server/product"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import React from "react"
import { Product } from "@/db/schema"
import { productTypeEnum } from "@/constants/product-types"

type ComponentVariations = {
  productId: string
  variations: Array<{
    variation: { id: string; name: string }
    options: Array<{ id: string; value: string }>
  }>
}

export default function ProductForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [availableProducts, setAvailableProducts] = React.useState<Product[]>(
    []
  )
  const [componentVariationsMap, setComponentVariationsMap] = React.useState<
    Map<string, ComponentVariations>
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

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      type: productTypeEnum.enum.RAW,
      unit: "",
      minimumStockLevel: 0,
      components: [],
      variations: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "components",
  })

  const {
    fields: variationFields,
    append: appendVariation,
    remove: removeVariation,
  } = useFieldArray({
    control: form.control,
    name: "variations",
  })

  // Load component variations when component is selected
  const handleComponentChange = React.useCallback(
    async (componentId: string, index: number) => {
      if (!componentId) {
        // Clear mapping rules when component is cleared
        form.setValue(`components.${index}.variantMappingRules`, undefined)
        return
      }

      const componentData = await getProductWithVariations(componentId)
      if (componentData.success && componentData.data) {
        setComponentVariationsMap((prev) => {
          const newMap = new Map(prev)
          newMap.set(componentId, {
            productId: componentId,
            variations: componentData.data.variations,
          })
          return newMap
        })

        // Auto-generate mapping rules if component has variations
        const currentRules = form.getValues(`components.${index}.variantMappingRules`) || []
        const productVariations = form.getValues("variations") || []
        
        if (componentData.data.variations.length > 0 && currentRules.length === 0) {
          // Initialize mapping rules with "mapped" strategy by default
          const initialRules = componentData.data.variations.map((compVar) => {
            const matchingProductVar = productVariations.find(
              (prodVar) => prodVar.name === compVar.variation.name
            )
            return {
              componentVariationName: compVar.variation.name,
              strategy: "mapped" as const,
              productVariationName: matchingProductVar?.name,
              defaultOptionValue: undefined,
            }
          })
          form.setValue(`components.${index}.variantMappingRules`, initialRules)
        }
      }
    },
    [form]
  )

  async function onSubmit(values: z.infer<typeof productFormSchema>) {
    setIsLoading(true)
    const result = await createProduct(values)

    if (result.success) {
      toast.success("Product created successfully")
      // Refresh products from the server to keep list authoritative
      await loadProducts()
      // Reset form for creating the next product
      form.reset()
    } else {
      toast.error(result.message)
    }

    setIsLoading(false)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-1">
              <FormLabel className="text-base font-normal text-dark-500">
                Name
              </FormLabel>
              <FormControl>
                <Input
                  required
                  placeholder="Product name"
                  {...field}
                  className="book-form_input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Variations section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <FormLabel>Variations</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendVariation({ name: "", options: [] })}
            >
              <Plus className="size-4 mr-2" /> Add Variation
            </Button>
          </div>

          {variationFields.map((variation, vIndex) => {
            const options = form.watch(`variations.${vIndex}.options`) || []
            return (
              <div key={variation.id} className="space-y-3 rounded-md border p-4">
                <div className="flex items-end gap-4">
                  <FormField
                    control={form.control}
                    name={`variations.${vIndex}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="sr-only">Variation Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Variation name (e.g., Color, Size)"
                            className="book-form_input"
                            {...field}
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
                    onClick={() => removeVariation(vIndex)}
                    className="shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <FormLabel className="text-sm">Options</FormLabel>
                  {options.map((_: string, oIndex: number) => (
                    <div key={oIndex} className="flex items-end gap-4">
                      <FormField
                        control={form.control}
                        name={`variations.${vIndex}.options.${oIndex}`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="sr-only">Option</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Option (e.g., White, Black, S, M)"
                                className="book-form_input"
                                {...field}
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
                          const current = form.getValues(`variations.${vIndex}.options`) || []
                          const next = current.filter((_: string, i: number) => i !== oIndex)
                          form.setValue(`variations.${vIndex}.options`, next as any, { shouldValidate: true })
                        }}
                        className="shrink-0"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const current = form.getValues(`variations.${vIndex}.options`) || []
                      const next = [...current, ""]
                      form.setValue(`variations.${vIndex}.options`, next as any, { shouldValidate: true })
                    }}
                    className="mt-1"
                  >
                    <Plus className="size-4 mr-2" /> Add Option
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {productTypeEnum.options.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
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
          name="unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unit</FormLabel>
              <FormControl>
                <Input
                  required
                  placeholder="Unit (e.g., pcs, kg, m)"
                  {...field}
                  className="book-form_input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="minimumStockLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimum Stock Level</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Minimum quantity before alert (e.g., 100)"
                  {...field}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? 0 : parseInt(e.target.value)
                    )
                  }
                  className="book-form_input"
                />
              </FormControl>
              <FormMessage />
              <p className="text-xs text-muted-foreground mt-1">
                Alert when inventory falls below this quantity
              </p>
            </FormItem>
          )}
        />
        {form.watch("type") !== productTypeEnum.enum.RAW && (
          <FormField
            control={form.control}
            name="components"
            render={() => (
              <FormItem>
                <FormLabel>Components</FormLabel>
                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const componentId = form.watch(`components.${index}.componentId`)
                    const componentVariations = componentId 
                      ? componentVariationsMap.get(componentId)?.variations || []
                      : []
                    const productVariations = form.watch("variations") || []
                    
                    return (
                      <div key={field.id} className="space-y-3 rounded-md border p-4">
                        <div className="flex items-end gap-4">
                          <FormField
                            control={form.control}
                            name={`components.${index}.componentId`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="sr-only">Component</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={(value) => {
                                    field.onChange(value)
                                    handleComponentChange(value, index)
                                  }}
                                >
                                  <FormControl>
                                    <SelectTrigger className="book-form_input">
                                      <SelectValue placeholder="Select component" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="z-60">
                                    {availableProducts.map((product) => (
                                      <SelectItem
                                        key={product.id}
                                        value={product.id}
                                      >
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
                            name={`components.${index}.quantityRequired`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel className="sr-only">Quantity</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="1"
                                    placeholder="Quantity"
                                    className="book-form_input"
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseInt(e.target.value) || 0)
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
                            onClick={() => remove(index)}
                            className="shrink-0"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        
                        {/* Variant Mapping Rules */}
                        {componentVariations.length > 0 && (
                          <div className="space-y-2 border-t pt-3 mt-3">
                            <FormLabel className="text-sm font-medium">
                              Variant Mapping
                            </FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Configure how component variations map to product variants
                            </p>
                            {componentVariations.map((compVar, varIndex) => {
                              const mappingRules = form.watch(`components.${index}.variantMappingRules`) || []
                              const rule = mappingRules.find(
                                (r) => r.componentVariationName === compVar.variation.name
                              ) || { 
                                componentVariationName: compVar.variation.name,
                                strategy: "mapped" as const,
                              }
                              
                              const updateRule = (updates: Partial<typeof rule>) => {
                                const currentRules = form.getValues(`components.${index}.variantMappingRules`) || []
                                const newRules = [...currentRules]
                                const existingIndex = newRules.findIndex(
                                  (r) => r.componentVariationName === compVar.variation.name
                                )
                                
                                const updatedRule = {
                                  componentVariationName: compVar.variation.name,
                                  strategy: rule.strategy,
                                  productVariationName: rule.productVariationName,
                                  defaultOptionValue: rule.defaultOptionValue,
                                  ...updates,
                                }
                                
                                if (existingIndex >= 0) {
                                  newRules[existingIndex] = updatedRule
                                } else {
                                  newRules.push(updatedRule)
                                }
                                
                                form.setValue(`components.${index}.variantMappingRules`, newRules)
                              }
                              
                              return (
                                <div key={compVar.variation.id} className="space-y-3 rounded-md border p-3 bg-muted/30">
                                  <div className="flex items-center gap-2">
                                    <FormLabel className="text-sm font-medium">
                                      {compVar.variation.name}
                                    </FormLabel>
                                    <span className="text-xs text-muted-foreground">
                                      (Component Variation)
                                    </span>
                                  </div>
                                  
                                  <RadioGroup
                                    value={rule.strategy || "mapped"}
                                    onValueChange={(value: "mapped" | "default") => {
                                      updateRule({
                                        strategy: value,
                                        productVariationName: value === "mapped" ? rule.productVariationName : undefined,
                                        defaultOptionValue: value === "default" ? rule.defaultOptionValue : undefined,
                                      })
                                    }}
                                    className="gap-2"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="mapped" id={`${compVar.variation.id}-mapped`} />
                                      <Label htmlFor={`${compVar.variation.id}-mapped`} className="text-sm font-normal cursor-pointer">
                                        Map to product variation
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="default" id={`${compVar.variation.id}-default`} />
                                      <Label htmlFor={`${compVar.variation.id}-default`} className="text-sm font-normal cursor-pointer">
                                        Use fixed default value
                                      </Label>
                                    </div>
                                  </RadioGroup>
                                  
                                  {rule.strategy === "mapped" && (
                                    <FormItem>
                                      <FormLabel className="text-xs">
                                        Select Product Variation <span className="text-destructive">*</span>
                                      </FormLabel>
                                      <Select
                                        value={rule.productVariationName || ""}
                                        onValueChange={(value) => {
                                          updateRule({
                                            productVariationName: value || undefined,
                                          })
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Choose variation..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {productVariations.map((prodVar) => (
                                            <SelectItem key={prodVar.name} value={prodVar.name}>
                                              {prodVar.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {!rule.productVariationName && (
                                        <p className="text-xs text-destructive mt-1">
                                          Please select a product variation
                                        </p>
                                      )}
                                    </FormItem>
                                  )}
                                  
                                  {rule.strategy === "default" && (
                                    <FormItem>
                                      <FormLabel className="text-xs">
                                        Select Default Value <span className="text-destructive">*</span>
                                      </FormLabel>
                                      <Select
                                        value={rule.defaultOptionValue || ""}
                                        onValueChange={(value) => {
                                          updateRule({
                                            defaultOptionValue: value || undefined,
                                          })
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Choose option..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {compVar.options.map((opt) => (
                                            <SelectItem key={opt.id} value={opt.value}>
                                              {opt.value}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {!rule.defaultOptionValue && (
                                        <p className="text-xs text-destructive mt-1">
                                          Please select a default value
                                        </p>
                                      )}
                                    </FormItem>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      append({ 
                        componentId: "", 
                        quantityRequired: 0,
                        variantMappingRules: []
                      })
                    }
                  >
                    <Plus className="size-4 mr-2" />
                    Add Component
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button disabled={isLoading} type="submit" className="book-form_btn">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Create Product"
          )}
        </Button>
      </form>
    </Form>
  )
}
