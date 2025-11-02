import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { COLORS } from "@/constants/colors"

export const colorEnum = pgEnum("color", [...COLORS])

export const INVENTORY_ACTION_ENUM = pgEnum("inventory_action", [
  "PURCHASE",
  "PRODUCTION_OUTPUT",
  "PRODUCTION_CONSUMPTION",
  "CORRECTION",
])

export const products = pgTable("products", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
  name: varchar("name").notNull(),
  colors: colorEnum("colors")
    .array()
    .default(sql`'{}'::color[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const materials = pgTable("materials", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
  name: varchar("name").notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),

  materialId: uuid("material_id").references(() => materials.id, {
    onDelete: "set null",
  }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),

  quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
  action: INVENTORY_ACTION_ENUM("action").notNull().default("CORRECTION"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const inventory = pgTable("inventory", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
  materialId: uuid("material_id").references(() => materials.id, {
    onDelete: "cascade",
  }),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "cascade",
  }),
  quantityOnHand: numeric("quantity_on_hand", { precision: 18, scale: 4 })
    .notNull()
    .default("0"),
})

export const materialPerProduct = pgTable("material_per_product", {
  id: uuid("id").notNull().primaryKey().defaultRandom().unique(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  materialId: uuid("material_id")
    .references(() => materials.id, { onDelete: "cascade" })
    .notNull(),
  quantityPerProduct: numeric("quantity_per_product", {
    precision: 18,
    scale: 4,
  }).notNull(),
})