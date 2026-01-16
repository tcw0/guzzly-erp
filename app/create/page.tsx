import React from "react"
import { getProducts } from "@/server/product"
import CreateContent from "./CreateContent"

async function Create() {
  const { data: products } = await getProducts()

  return <CreateContent initialProducts={products || []} />
}

export default Create
