import React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import ProductForm from "@/components/forms/ProductForm"
import MaterialForm from "@/components/forms/MaterialForm"

const page = () => {
  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="grid h-full w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-full w-full text-xl font-bold">
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
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-full w-full text-xl font-bold">
              Create new Material
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Material</DialogTitle>
              <MaterialForm />
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}

export default page
