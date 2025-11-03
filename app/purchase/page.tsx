import React from "react"

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
import ProductForm from "@/components/forms/ProductForm"
import { Boxes } from "lucide-react"
import { getProducts } from "@/server/product"

async function Purchase() {
  const { data: products } = await getProducts()

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="flex h-full w-full flex-col gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-1/2 w-full text-xl font-bold flex flex-col items-center justify-center gap-4 bg-green-800 hover:bg-green-900">
              <Boxes className="size-16" />
              Create new Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
              <ProductForm />
            </DialogHeader>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.type}</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>
                    {product.createdAt
                      ? new Date(product.createdAt).toLocaleDateString()
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}

export default Purchase
