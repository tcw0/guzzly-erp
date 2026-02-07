"use client"

import React from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { getFinishedProducts, getProductWithVariations, getProductVariants } from "@/server/product"
import { createManualOrder, updateManualOrder } from "@/server/manual-orders"
import type { ManualOrderWithItems } from "@/server/manual-orders"
import type { Product } from "@/db/schema"

const manualOrderFormSchema = z.object({
  createdBy: z.string().trim().min(1, "Ersteller ist erforderlich"),
  name: z.string().min(1, "Name erforderlich"),
  orderNumber: z.string().min(1, "Bestellnummer erforderlich"),
  reason: z.string(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Produkt wählen"),
        variantId: z.string().min(1, "Variante wählen"),
        quantity: z.number().positive("Menge > 0"),
      })
    )
    .min(1, "Mindestens ein Produkt"),
})

type ManualOrderFormValues = z.infer<typeof manualOrderFormSchema>

type ProductVariationsMap = Map<
  string,
  {
    productId: string
    variations: Array<{ variation: { id: string; name: string }; options: Array<{ id: string; value: string }> }>
    variants: Array<{
      variant: { id: string }
      selections: Array<{ variationId: string; optionId: string; variationName: string; optionValue: string }>
    }>
  }
>

type ManualOrderFormProps = {
  onSuccess: () => void
  onCancel: () => void
  editOrder?: ManualOrderWithItems | null
}

export function ManualOrderForm({ onSuccess, onCancel, editOrder }: ManualOrderFormProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [products, setProducts] = React.useState<Product[]>([])
  const [productVariationsMap, setProductVariationsMap] = React.useState<ProductVariationsMap>(new Map())

  React.useEffect(() => {
    getFinishedProducts().then((r) => {
      if (r.success && r.data) setProducts(r.data)
    })
  }, [])

  // Preload product variations when editing and sync variation dropdowns from variantId
  React.useEffect(() => {
    if (!editOrder?.lineItems?.length) return
    const load = async () => {
      const next = new Map(productVariationsMap)
      for (const item of editOrder.lineItems) {
        if (!item.productId || next.has(item.productId)) continue
        const productData = await getProductWithVariations(item.productId)
        const variantsData = await getProductVariants(item.productId)
        if (productData.success && productData.data && variantsData.success && variantsData.data) {
          next.set(item.productId, {
            productId: item.productId,
            variations: productData.data.variations,
            variants: variantsData.data,
          })
        }
      }
      setProductVariationsMap(next)
    }
    load()
  }, [editOrder?.id])

  const defaultValues: ManualOrderFormValues = {
    createdBy: editOrder?.createdBy ?? "",
    name: editOrder?.name ?? "",
    orderNumber: editOrder?.orderNumber ?? "",
    reason: editOrder?.reason ?? "",
    items:
      editOrder?.lineItems?.length ?
        editOrder.lineItems.map((item) => ({
          productId: item.productId,
          variantId: item.productVariantId,
          quantity: parseFloat(item.quantity) || 1,
        }))
      : [{ productId: "", variantId: "", quantity: 1 }],
  }

  const form = useForm<ManualOrderFormValues>({
    resolver: zodResolver(manualOrderFormSchema),
    defaultValues,
  })

  // When product map is ready and we're editing, set variation_ fields from variantId
  React.useEffect(() => {
    if (!editOrder?.lineItems?.length) return
    editOrder.lineItems.forEach((item, index) => {
      const data = productVariationsMap.get(item.productId)
      if (!data || !item.productVariantId) return
      const variant = data.variants.find((v) => v.variant.id === item.productVariantId)
      if (!variant) return
      variant.selections.forEach((s) => {
        form.setValue(`items.${index}.variation_${s.variationId}` as any, s.optionId)
      })
    })
  }, [editOrder?.id, productVariationsMap, form])

  React.useEffect(() => {
    form.reset({
      createdBy: editOrder?.createdBy ?? "",
      name: editOrder?.name ?? "",
      orderNumber: editOrder?.orderNumber ?? "",
      reason: editOrder?.reason ?? "",
      items:
        editOrder?.lineItems?.length
          ? editOrder.lineItems.map((item) => ({
              productId: item.productId,
              variantId: item.productVariantId,
              quantity: parseFloat(item.quantity) || 1,
            }))
          : [{ productId: "", variantId: "", quantity: 1 }],
    })
  }, [editOrder?.id, form])

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const handleProductChange = React.useCallback(
    async (productId: string, index: number) => {
      if (!productId) {
        form.setValue(`items.${index}.variantId`, "")
        return
      }
      const productData = await getProductWithVariations(productId)
      const variantsData = await getProductVariants(productId)
      if (productData.success && productData.data && variantsData.success && variantsData.data) {
        setProductVariationsMap((prev) => {
          const next = new Map(prev)
          next.set(productId, {
            productId,
            variations: productData.data.variations,
            variants: variantsData.data,
          })
          return next
        })
        if (productData.data.variations.length === 0 && variantsData.data.length > 0) {
          form.setValue(`items.${index}.variantId`, variantsData.data[0].variant.id)
        } else {
          form.setValue(`items.${index}.variantId`, "")
        }
      }
    },
    [form]
  )

  const findVariantId = React.useCallback(
    (productId: string, selectedOptionIds: Record<string, string>): string | undefined => {
      const data = productVariationsMap.get(productId)
      if (!data) return undefined
      return data.variants.find((v) => {
        const sel = new Map(v.selections.map((s) => [s.variationId, s.optionId]))
        return Object.entries(selectedOptionIds).every(([vid, oid]) => sel.get(vid) === oid)
      })?.variant.id
    },
    [productVariationsMap]
  )

  async function onSubmit(values: ManualOrderFormValues) {
    setIsLoading(true)
    const payload = {
      name: values.name.trim(),
      orderNumber: values.orderNumber.trim(),
      reason: values.reason.trim(),
      createdBy: values.createdBy.trim(),
      items: values.items.map((i) => ({
        productVariantId: i.variantId,
        quantity: i.quantity,
      })),
    }

    if (editOrder) {
      const result = await updateManualOrder(editOrder.id, payload)
      if (result.success) {
        toast.success("Auftrag gespeichert")
        onSuccess()
      } else {
        toast.error(result.message ?? "Fehler beim Speichern")
      }
    } else {
      const result = await createManualOrder(payload)
      if (result.success) {
        toast.success("Manueller Auftrag angelegt")
        onSuccess()
      } else {
        toast.error(result.message ?? "Fehler beim Anlegen")
      }
    }
    setIsLoading(false)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="createdBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ersteller Manueller Auftrag</FormLabel>
              <FormControl>
                <Input placeholder="Name des Erstellers" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="orderNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bestellnummer</FormLabel>
              <FormControl>
                <Input placeholder="Bestellnummer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grund</FormLabel>
              <FormControl>
                <Input placeholder="Grund (optional)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="items"
          render={() => (
            <FormItem>
              <FormLabel>Produkte</FormLabel>
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const productId = form.watch(`items.${index}.productId`)
                  const productData = productId ? productVariationsMap.get(productId) : null
                  const hasVariations = productData && productData.variations.length > 0

                  return (
                    <div key={field.id} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.productId`}
                        render={({ field: f }) => (
                          <FormItem className="min-w-[180px] flex-1">
                            <FormLabel className="sr-only">Produkt</FormLabel>
                            <Select
                              value={f.value}
                              onValueChange={(v) => {
                                f.onChange(v)
                                handleProductChange(v, index)
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Produkt wählen" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {hasVariations && productData && (
                        <>
                          {productData.variations.map((v) => (
                            <FormField
                              key={v.variation.id}
                              control={form.control}
                              name={`items.${index}.variation_${v.variation.id}` as any}
                              render={({ field: f }) => (
                                <FormItem className="min-w-[120px]">
                                  <FormLabel className="sr-only">{v.variation.name}</FormLabel>
                                  <Select
                                    value={f.value ?? ""}
                                    onValueChange={(val) => {
                                      f.onChange(val)
                                      const all: Record<string, string> = {}
                                      productData.variations.forEach((vr) => {
                                        const x = form.getValues(`items.${index}.variation_${vr.variation.id}` as any)
                                        if (x) all[vr.variation.id] = x
                                      })
                                      all[v.variation.id] = val
                                      if (Object.keys(all).length === productData.variations.length) {
                                        const vid = findVariantId(productId, all)
                                        if (vid) form.setValue(`items.${index}.variantId`, vid)
                                      }
                                    }}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={v.variation.name} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {v.options.map((opt) => (
                                        <SelectItem key={opt.id} value={opt.id}>
                                          {opt.value}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          ))}
                        </>
                      )}
                      <FormField
                        control={form.control}
                        name={`items.${index}.variantId`}
                        render={({ field: f }) => (
                          <FormItem className="hidden">
                            <FormControl>
                              <input type="hidden" {...f} value={f.value} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field: f }) => (
                          <FormItem className="w-20">
                            <FormLabel className="sr-only">Menge</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                {...f}
                                onChange={(e) => f.onChange(parseFloat(e.target.value) || 1)}
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
                  )
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ productId: "", variantId: "", quantity: 1 })}
                >
                  <Plus className="size-4 mr-2" />
                  Produkt hinzufügen
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {editOrder ? "Speichern" : "Auftrag anlegen"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </form>
    </Form>
  )
}
