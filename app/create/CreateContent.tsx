"use client"

/*
CreateContent.tsx is just a client wrapper so the page (a server component) can preload data via getProducts() and keep server rendering, 
while the interactive dialogs/tables run on the client. You could inline the same logic in page.tsx, but then page.tsx would need "use client" 
and you’d lose server-side data fetching on first render. Keeping page.tsx as a server component + a client child balances both: server fetch 
for initial products, client state for dialogs/edit flows.
*/

import React from "react"
import { Boxes, Pencil, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import ProductForm from "@/components/forms/ProductForm"
import { Product } from "@/db/schema"
import { getProducts, getProductForEdit } from "@/server/product"
import { toast } from "sonner"

function formatDate(value?: Date | string | null) {
  if (!value) return "-"
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString()
}

export default function CreateContent({
  initialProducts,
}: {
  initialProducts: Product[]
}) {
  const [products, setProducts] = React.useState<Product[]>(initialProducts)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editData, setEditData] = React.useState<null | NonNullable<
    Awaited<ReturnType<typeof getProductForEdit>>["data"]
  >>(null)
  const [loadingEditId, setLoadingEditId] = React.useState<string | null>(null)

  const refreshProducts = React.useCallback(async () => {
    const res = await getProducts()
    if (res.success && res.data) {
      setProducts(res.data)
    }
  }, [])

  const openEdit = React.useCallback(async (productId: string) => {
    setLoadingEditId(productId)
    const res = await getProductForEdit(productId)
    if (res.success && res.data) {
      setEditData(res.data)
      setEditOpen(true)
    } else {
      toast.error(res.message || "Failed to load product")
    }
    setLoadingEditId(null)
  }, [])

  const closeEdit = React.useCallback(() => {
    setEditOpen(false)
    setEditData(null)
  }, [])

  const handleCreateSuccess = React.useCallback(async () => {
    await refreshProducts()
    setCreateOpen(false)
  }, [refreshProducts])

  const handleEditSuccess = React.useCallback(async () => {
    await refreshProducts()
    closeEdit()
  }, [refreshProducts, closeEdit])

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="flex h-full w-full flex-col gap-4">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-1/2 w-full text-xl font-bold flex flex-col items-center justify-center gap-4 bg-green-800 hover:bg-green-900">
              <Boxes className="size-16" />
              Create new Product
            </Button>
          </DialogTrigger>
          <DialogContent className="p-0 max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="px-6 pt-6 shrink-0">
              <DialogTitle>Add Product</DialogTitle>
            </DialogHeader>
            <ScrollArea className="px-6 pb-6 max-h-[75vh] overflow-auto">
              <ProductForm onSuccess={handleCreateSuccess} />
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <div className="max-h-[50vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.type}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>{formatDate(product.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => openEdit(product.id)}
                      disabled={loadingEditId === product.id}
                    >
                      {loadingEditId === product.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Pencil className="size-4" />
                      )}
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => (open ? setEditOpen(true) : closeEdit())}
      >
        <DialogContent className="p-0 max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6 shrink-0">
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-6 max-h-[75vh] overflow-auto">
            {editData ? (
              <ProductForm
                mode="edit"
                productId={editData.product.id}
                initialValues={{
                  name: editData.product.name,
                  type: editData.product.type as any,
                  unit: editData.product.unit,
                  minimumStockLevel: editData.minimumStockLevel,
                  variations: editData.variations,
                  components: editData.components.map((c) => ({
                    componentId: c.componentId,
                    quantityRequired: c.quantityRequired,
                    variantMappingRules: [],
                  })),
                }}
                onSuccess={handleEditSuccess}
                onCancel={closeEdit}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-4">
                <Loader2 className="size-4 animate-spin" /> Loading product...
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </section>
  )
}
