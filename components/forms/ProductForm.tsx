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
import { productFormSchema } from "@/lib/validation"
import { createProduct } from "@/server/product"
import { getProducts } from "@/server/product"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import React from "react"
import { Product } from "@/db/schema"
import { productTypeEnum } from "@/constants/product-types"

export default function ProductForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [availableProducts, setAvailableProducts] = React.useState<Product[]>(
    []
  )

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
      components: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "components",
  })

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
        {form.watch("type") !== productTypeEnum.enum.RAW && (
          <FormField
            control={form.control}
            name="components"
            render={() => (
              <FormItem>
                <FormLabel>Components</FormLabel>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-4">
                      <FormField
                        control={form.control}
                        name={`components.${index}.componentId`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="sr-only">Component</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
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
                                step="0.1"
                                placeholder="Quantity"
                                className="book-form_input"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseFloat(e.target.value))
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
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      append({ componentId: "", quantityRequired: 0 })
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
