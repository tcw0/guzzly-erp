import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Boxes, ChevronDown } from "lucide-react"
import { getProductComponentRelations } from "@/server/bom"

function formatQuantity(qty: string | number) {
  const n = typeof qty === "string" ? Number(qty) : qty
  if (Number.isNaN(n)) return String(qty)
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(3).replace(/\.\d*?0+$/,"")
}

async function BOMOverview() {
  const { success, data, message } = await getProductComponentRelations()

  if (!success) {
    return (
      <section className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>BOM Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{message || "Failed to load relations"}</p>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Boxes className="size-6" />
        <h1 className="text-xl font-semibold">Bill of Materials Overview</h1>
      </div>
      <Separator />
      <ScrollArea className="h-full w-full rounded-md border">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.map(({ product, variants }) => (
            <Card key={product.id}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base font-semibold">
                  {product.name}
                </CardTitle>
                <div className="text-xs text-muted-foreground">Type: {product.type}</div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {variants.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No variants or components mapped.</div>
                  ) : (
                    variants.map((v) => (
                      <Collapsible key={v.id} className="rounded-md border">
                        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Variant</Badge>
                            <span className="font-mono text-xs">{v.sku}</span>
                          </div>
                          <ChevronDown className="size-4 shrink-0 opacity-70" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Component Product</TableHead>
                                <TableHead>Component Variant SKU</TableHead>
                                <TableHead className="w-[120px]">Quantity</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {v.components.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-muted-foreground">No components</TableCell>
                                </TableRow>
                              ) : (
                                v.components.map((c) => (
                                  <TableRow key={`${v.id}-${c.variantId}`}>
                                    <TableCell className="font-medium">{c.productName}</TableCell>
                                    <TableCell className="font-mono text-xs">{c.variantSku}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{formatQuantity(c.quantityRequired)}</Badge>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </section>
  )
}

export default BOMOverview
