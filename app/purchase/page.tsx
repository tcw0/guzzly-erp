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
import { Boxes } from "lucide-react"
import { getPurchases } from "@/server/purchase"
import PurchaseForm from "@/components/forms/PurchaseForm"

async function Purchase() {
  const { data: purchases } = await getPurchases()

  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="flex h-full w-full flex-col gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-1/2 w-full text-xl font-bold flex flex-col items-center justify-center gap-4 bg-green-800 hover:bg-green-900">
              <Boxes className="size-16" />
              Add Purchase
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Purchase</DialogTitle>
              <PurchaseForm />
            </DialogHeader>
          </DialogContent>
        </Dialog>

        <div className="max-h-[50vh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases?.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-medium">{purchase.productName}</TableCell>
                  <TableCell>{purchase.quantity}</TableCell>
                  <TableCell>{purchase.unit}</TableCell>
                  <TableCell>
                    {purchase.createdAt
                      ? new Date(purchase.createdAt as unknown as string).toLocaleDateString()
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
