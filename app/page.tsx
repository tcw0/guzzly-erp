import AdjustmentForm from "@/components/forms/AdjustmentForm"
import OutputForm from "@/components/forms/OutputForm"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function Home() {
  return (
    <section className="flex h-[calc(100vh-4rem)] w-full flex-col gap-4 p-8">
      <div className="grid h-full w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-full w-full text-xl font-bold">
              Add Output
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Output</DialogTitle>
              <OutputForm />
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-full w-full text-xl font-bold">
              Make Adjustment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Make Adjustment</DialogTitle>
              <AdjustmentForm />
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
