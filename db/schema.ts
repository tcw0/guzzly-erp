import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core"
import { PRODUCT_TYPES } from "@/constants/product-types"

export const INVENTORY_ACTION_ENUM = pgEnum("inventory_action", [
  "PURCHASE",
  "PRODUCTION_OUTPUT",
  "PRODUCTION_CONSUMPTION",
  "CORRECTION",
])

export const PRODUCT_TYPE_ENUM = pgEnum("product_type", PRODUCT_TYPES)

export const products = pgTable("products", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
  name: varchar("name").notNull(),
  type: PRODUCT_TYPE_ENUM("type").notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
  productId: uuid("product_id")
    .references(() => products.id, {
      onDelete: "set null",
    })
    .notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
  action: INVENTORY_ACTION_ENUM("action").notNull().default("CORRECTION"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const inventory = pgTable("inventory", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
  productId: uuid("product_id")
    .references(() => products.id, {
      onDelete: "cascade",
    })
    .notNull(),
  quantityOnHand: numeric("quantity_on_hand", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
})

export const billOfMaterials = pgTable("bill_of_materials", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  componentId: uuid("component_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  quantityRequired: numeric("quantity_required", {
    precision: 18,
    scale: 4,
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
export type BillOfMaterials = typeof billOfMaterials.$inferSelect
// export type ManufacturingStep = typeof manufacturingSteps.$inferSelect
