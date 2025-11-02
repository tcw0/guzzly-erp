interface ProductParams {
  name: string
  colors?: (typeof COLORS)[number][]
  materials: Array<{
    materialId: string
    quantityPerProduct: number
  }>
}
