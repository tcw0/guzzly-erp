// "use client"

// import { zodResolver } from "@hookform/resolvers/zod"
// import { useForm } from "react-hook-form"
// import { z } from "zod"

// import { Button } from "@/components/ui/button"
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form"
// import { Input } from "@/components/ui/input"
// import { materialFormSchema } from "@/lib/validation"
// import { createMaterial } from "@/server/material"
// import { toast } from "sonner"
// import React from "react"
// import { Loader2 } from "lucide-react"
// import { useRouter } from "next/navigation"

// export default function MaterialForm() {
//   const router = useRouter()
//   const [isLoading, setIsLoading] = React.useState(false)
//   const form = useForm<z.infer<typeof materialFormSchema>>({
//     resolver: zodResolver(materialFormSchema),
//     defaultValues: {
//       name: "",
//       unit: "",
//     },
//   })

//   async function onSubmit(values: z.infer<typeof materialFormSchema>) {
//     setIsLoading(true)
//     const result = await createMaterial(values)

//     if (result.success) {
//       toast.success("Material created successfully")
//     } else {
//       toast.error(result.message)
//     }

//     setIsLoading(false)
//     router.refresh()
//   }

//   return (
//     <Form {...form}>
//       <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
//         <FormField
//           control={form.control}
//           name="name"
//           render={({ field }) => (
//             <FormItem>
//               <FormLabel>Name</FormLabel>
//               <FormControl>
//                 <Input placeholder="Material name" {...field} />
//               </FormControl>
//               <FormMessage />
//             </FormItem>
//           )}
//         />
//         <FormField
//           control={form.control}
//           name="unit"
//           render={({ field }) => (
//             <FormItem>
//               <FormLabel>Unit</FormLabel>
//               <FormControl>
//                 <Input placeholder="Unit (kg, g, pcs, ...)" {...field} />
//               </FormControl>
//               <FormMessage />
//             </FormItem>
//           )}
//         />
//         <Button disabled={isLoading} type="submit">
//           {isLoading ? (
//             <Loader2 className="size-4 animate-spin" />
//           ) : (
//             "Create Material"
//           )}
//         </Button>
//       </form>
//     </Form>
//   )
// }
