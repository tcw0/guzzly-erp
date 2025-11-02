"use server"

import { Material, materials } from "@/db/schema"
import { db } from "@/db/drizzle"

export const createMaterial = async (
  material: Omit<Material, "id" | "createdAt">
) => {
  try {
    const newMaterial = await db
      .insert(materials)
      .values({
        ...material,
      })
      .returning()

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newMaterial[0])),
    }
  } catch (error) {
    console.log(error)

    return {
      success: false,
      message: "An error occurred while creating the material",
    }
  }
}

export const getMaterials = async () => {
  try {
    const allMaterials = await db.select().from(materials)
    return {
      success: true,
      data: JSON.parse(JSON.stringify(allMaterials)),
    }
  } catch (error) {
    console.log(error)

    return {
      success: false,
      message: "An error occurred while fetching materials",
    }
  }
}
