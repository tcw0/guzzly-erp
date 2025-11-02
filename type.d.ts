interface ProductParams {
  name: string
  colors?: (typeof COLORS)[number][]
  materials: Array<{
    materialId: string
    quantityPerProduct: number
  }>
}

interface MaterialParams {
  name: string
  unit: string
}

interface MaterialParams {
  name: string
  unit: string
}
