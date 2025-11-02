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
import { COLORS } from "@/constants/colors"
import { productFormSchema } from "@/lib/validation"
import { createProduct } from "@/server/product"
import { getMaterials } from "@/server/material"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import React from "react"

type Material = {
  id: string
  name: string
  unit: string
}

export default function ProductForm() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [materials, setMaterials] = React.useState<Material[]>([])

  React.useEffect(() => {
    const loadMaterials = async () => {
      const result = await getMaterials()
      console.log(result)
      if (result.success) {
        setMaterials(result.data)
      }
    }
    loadMaterials()
  }, [])

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      colors: [],
      materials: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "materials",
  })

  async function onSubmit(values: z.infer<typeof productFormSchema>) {
    setIsLoading(true)
    const result = await createProduct(values)

    if (result.success) {
      toast.success("Product created successfully")
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
          name="colors"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Colors</FormLabel>
              <div
                className="flex flex-wrap gap-2 mt-2"
                role="group"
                aria-label="Colors"
              >
                {COLORS.map((color) => {
                  const checked = (field.value ?? []).includes(color as any)
                  return (
                    <label
                      key={color}
                      className="inline-flex items-center space-x-2"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(val) => {
                          const isChecked = !!val
                          if (isChecked && !checked) {
                            field.onChange([...(field.value ?? []), color])
                          } else if (!isChecked && checked) {
                            field.onChange(
                              (field.value ?? []).filter(
                                (c: string) => c !== color
                              )
                            )
                          }
                        }}
                      />
                      <span className="text-sm">{color}</span>
                    </label>
                  )
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="materials"
          render={() => (
            <FormItem>
              <FormLabel>Materials</FormLabel>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-4">
                    <FormField
                      control={form.control}
                      name={`materials.${index}.materialId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="sr-only">Material</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="book-form_input">
                                <SelectValue placeholder="Select material" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="z-60">
                              {materials.map((material) => (
                                <SelectItem
                                  key={material.id}
                                  value={material.id}
                                >
                                  {material.name} ({material.unit})
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
                      name={`materials.${index}.quantityPerProduct`}
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
                    append({ materialId: "", quantityPerProduct: 0 })
                  }
                >
                  <Plus className="size-4 mr-2" />
                  Add Material
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
            "Create Product"
          )}
        </Button>
      </form>
    </Form>
  )
}
