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
import { purchaseFormSchema } from "@/lib/validation"
import { createPurchase, getRawProducts } from "@/server/purchase"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Product } from "@/db/schema"

export default function PurchaseForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [rawProducts, setRawProducts] = React.useState<Product[]>([])

  const loadProducts = React.useCallback(async () => {
    const result = await getRawProducts()
    if (result.success && result.data) {
      setRawProducts(result.data)
    }
  }, [])

  React.useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const form = useForm<z.infer<typeof purchaseFormSchema>>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      purchases: [{ productId: "", quantity: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "purchases",
  })

  async function onSubmit(values: z.infer<typeof purchaseFormSchema>) {
    setIsLoading(true)
    const result = await createPurchase(values)

    if (result.success) {
      toast.success("Purchase recorded successfully")
      await loadProducts()
      form.reset({ purchases: [{ productId: "", quantity: 0 }] })
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
          name="purchases"
          render={() => (
            <FormItem>
              <FormLabel>Purchased Raw Products</FormLabel>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-4">
                    <FormField
                      control={form.control}
                      name={`purchases.${index}.productId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="sr-only">Product</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="book-form_input">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="z-60">
                              {rawProducts.map((p) => (
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
                      name={`purchases.${index}.quantity`}
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

        <Button disabled={isLoading} type="submit" className="book-form_btn">
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Record Purchase"
          )}
        </Button>
      </form>
    </Form>
  )
}
