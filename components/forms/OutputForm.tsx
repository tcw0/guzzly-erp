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
import { getFinishedProducts } from "@/server/product"
import { createOutput } from "@/server/output"

export default function OutputForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [availableProducts, setAvailableProducts] = React.useState<Product[]>(
    []
  )

  React.useEffect(() => {
    const loadProducts = async () => {
      const result = await getFinishedProducts()
      console.log(result)
      if (result.success && result.data) {
        setAvailableProducts(result.data)

        console.log(result.data)
      }
    }
    loadProducts()
  }, [])

  const form = useForm<z.infer<typeof outputFormSchema>>({
    resolver: zodResolver(outputFormSchema),
    defaultValues: {
      outputs: [{ productId: "", quantity: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "outputs",
  })

  async function onSubmit(values: z.infer<typeof outputFormSchema>) {
    setIsLoading(true)
    const result = await createOutput(values)

    if (result.success) {
      toast.success("Production output recorded successfully")
      form.reset({
        outputs: [{ productId: "", quantity: 0 }],
      })
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
          name="outputs"
          render={() => (
            <FormItem>
              <FormLabel>Production Outputs</FormLabel>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-4">
                    <FormField
                      control={form.control}
                      name={`outputs.${index}.productId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="sr-only">Product</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
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
                        <FormItem className="flex-1">
                          <FormLabel className="sr-only">Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              placeholder="Quantity"
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
