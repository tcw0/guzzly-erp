import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { PRODUCT_TYPES } from "@/constants/product-types"
import { INVENTORY_ACTIONS } from "@/constants/inventory-actions"

export const PRODUCT_TYPE_ENUM = pgEnum("product_type", PRODUCT_TYPES)
export const INVENTORY_ACTION_ENUM = pgEnum(
  "inventory_action",
  INVENTORY_ACTIONS
)

export const products = pgTable("products", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  type: PRODUCT_TYPE_ENUM("type").notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Variations for products (e.g., Color, Size)
export const productVariations = pgTable("product_variations", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Options under a variation (e.g., for Color: White, Black)
export const productVariationOptions = pgTable("product_variation_options", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  variationId: uuid("variation_id")
    .references(() => productVariations.id, { onDelete: "cascade" })
    .notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Product variants represent unique combinations of variation options (SKUs)
export const productVariants = pgTable("product_variants", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  sku: varchar("sku", { length: 255 }), // Optional SKU code
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Junction table linking variants to specific variation option values
export const productVariantSelections = pgTable(
  "product_variant_selections",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .references(() => productVariants.id, { onDelete: "cascade" })
      .notNull(),
    variationId: uuid("variation_id")
      .references(() => productVariations.id, { onDelete: "cascade" })
      .notNull(),
    optionId: uuid("option_id")
      .references(() => productVariationOptions.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    variantVariationUnique: unique("variant_variation_unique").on(
      table.variantId,
      table.variationId
    ),
  })
)

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .references(() => products.id, {
      onDelete: "set null",
    }),
  variantId: uuid("variant_id")
    .references(() => productVariants.id, {
      onDelete: "set null",
    }),
  quantity: numeric("quantity", { precision: 18, scale: 0 }).notNull(),
  action: INVENTORY_ACTION_ENUM("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .references(() => productVariants.id, {
        onDelete: "cascade",
      })
      .notNull(),
    quantityOnHand: numeric("quantity_on_hand", { precision: 18, scale: 0 })
      .notNull()
      .default("0"),
  },
  (table) => ({
    inventoryVariantIdUnique: unique("inventory_variant_id_unique").on(
      table.variantId
    ),
  })
)

// Variant-aware Bill of Materials - links product variants to component variants
export const variantBillOfMaterials = pgTable("variant_bill_of_materials", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  productVariantId: uuid("product_variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .notNull(),
  componentVariantId: uuid("component_variant_id")
    .references(() => productVariants.id, { onDelete: "cascade" })
    .notNull(),
  quantityRequired: numeric("quantity_required", {
    precision: 18,
    scale: 0,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// export const manufacturingSteps = pgTable("manufacturing_steps", {
//   id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
//   productId: uuid("product_id")
//     .references(() => products.id, { onDelete: "cascade" })
//     .notNull(),
//   stepNumber: numeric("step_number", { precision: 2, scale: 0 }).notNull(),
//   description: varchar("description", { length: 500 }).notNull(),
//   estimatedDuration: numeric("estimated_duration_minutes", {
//     precision: 6,
//     scale: 2,
//   }),
//   createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
// })

export type Product = typeof products.$inferSelect
export type VariantBillOfMaterials = typeof variantBillOfMaterials.$inferSelect
export type ProductVariation = typeof productVariations.$inferSelect
export type ProductVariationOption = typeof productVariationOptions.$inferSelect
export type ProductVariant = typeof productVariants.$inferSelect
export type ProductVariantSelection = typeof productVariantSelections.$inferSelect
// export type ManufacturingStep = typeof manufacturingSteps.$inferSelect
