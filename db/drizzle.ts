import config from "@/lib/config"
import { Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"

const pool = new Pool({ connectionString: config.env.databaseUrl })

export const db = drizzle(pool, { logger: false, casing: "snake_case" })
