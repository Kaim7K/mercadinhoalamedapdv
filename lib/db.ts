import { sql } from "@vercel/postgres";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import type { CartItem, Payment, Product, Role, User } from "./types";

type Row = Record<string, unknown>;

export function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export function money(value: unknown) {
  return Number(value ?? 0);
}

export function productFromRow(row: Row): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category ?? ""),
    barcode: String(row.barcode ?? ""),
    internalCode: String(row.internal_code),
    imageUrl: String(row.image_url ?? ""),
    salePrice: money(row.sale_price),
    costPrice: row.cost_price === null ? null : money(row.cost_price),
    stock: money(row.stock),
    unit: String(row.unit),
    active: Boolean(row.active)
  };
}

export async function query<T extends Row = Row>(text: string, values: unknown[] = []) {
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    throw new Error("Banco nao configurado. Vincule um Postgres ao projeto na Vercel e defina DATABASE_URL/POSTGRES_URL.");
  }
  const result = await sql.query(text, values);
  return result.rows as T[];
}

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;
  const schema = await readFile(join(process.cwd(), "db", "schema.sql"), "utf8");
  for (const statement of schema.split(";").map((item) => item.trim()).filter(Boolean)) {
    await query(statement);
  }
  await seed();
  schemaReady = true;
}

async function seed() {
  const rows = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM app_users");
  if (Number(rows[0]?.count ?? 0) > 0) return;

  await query(
    "INSERT INTO app_users (name, email, password_hash, role) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)",
    ["Ana Paula", "gerente@alameda.com", hashPassword("123456"), "manager", "Joao Silva", "vendedor@alameda.com", hashPassword("123456"), "seller"]
  );

  const products = [
    ["Arroz Tio Joao 5kg", "Mercearia", "7891234567895", "ARR0001", 29.9, 22.5, 42, "pacote"],
    ["Feijao Carioca Kicaldo 1kg", "Mercearia", "7896058501234", "FEI0002", 7.49, 5.2, 35, "unidade"],
    ["Oleo de Soja Liza 900ml", "Mercearia", "7896021300057", "OLE0003", 6.49, 4.95, 28, "unidade"],
    ["Leite Integral Italac 1L", "Laticinios", "7898087702198", "LEI0004", 4.99, 3.75, 18, "unidade"],
    ["Cafe Pilao Tradicional 500g", "Mercearia", "7891025100127", "CAF0005", 16.9, 12.4, 30, "pacote"],
    ["Acucar Refinado Uniao 1kg", "Mercearia", "7891039000210", "ACU0006", 4.49, 3.1, 50, "unidade"],
    ["Sabonete Dove Original 90g", "Higiene", "7891150067630", "SAB0007", 2.89, 1.75, 60, "unidade"],
    ["Detergente Ype Neutro 500ml", "Limpeza", "7896098900244", "DET0008", 1.99, 1.1, 72, "unidade"],
    ["Cerveja Brahma Lata 350ml", "Bebidas", "7891010000219", "CER0009", 3.49, 2.35, 72, "unidade"],
    ["Papel Higienico Neve Folha Dupla 12un", "Higiene", "7891173006350", "PAP0010", 15.9, 11.8, 25, "pacote"]
  ];

  for (const product of products) {
    await query(
      "INSERT INTO products (name, category, barcode, internal_code, sale_price, cost_price, stock, unit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      product
    );
  }

  await query("INSERT INTO app_settings (key, value) VALUES ('suspendedLimit', '3'::jsonb)");
}

export async function login(email: string, password: string): Promise<User | null> {
  await ensureSchema();
  const rows = await query<Row>(
    "SELECT id, name, email, role, active FROM app_users WHERE email = $1 AND password_hash = $2 AND active = TRUE LIMIT 1",
    [email, hashPassword(password)]
  );
  const row = rows[0];
  if (!row) return null;
  return { id: String(row.id), name: String(row.name), email: String(row.email), role: row.role as Role, active: Boolean(row.active) };
}

export async function getState(userId?: string, role?: Role) {
  await ensureSchema();
  const products = (await query("SELECT * FROM products ORDER BY name")).map(productFromRow);
  const users = await query<Row>("SELECT id, name, email, role, active FROM app_users ORDER BY name");
  const salesWhere = role === "seller" && userId ? "WHERE s.seller_id = $1" : "";
  const salesValues = role === "seller" && userId ? [userId] : [];
  const sales = await query<Row>(
    `SELECT s.*, COALESCE(json_agg(DISTINCT jsonb_build_object('productId', si.product_id, 'productName', si.product_name, 'quantity', si.quantity, 'unitPrice', si.unit_price, 'subtotal', si.subtotal)) FILTER (WHERE si.id IS NOT NULL), '[]') AS items,
     COALESCE(json_agg(DISTINCT jsonb_build_object('method', p.method, 'amount', p.amount)) FILTER (WHERE p.id IS NOT NULL), '[]') AS payments
     FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     LEFT JOIN payments p ON p.sale_id = s.id
     ${salesWhere}
     GROUP BY s.id
     ORDER BY s.created_at DESC
     LIMIT 80`,
    salesValues
  );
  const creditsWhere = role === "seller" && userId ? "WHERE seller_id = $1" : "";
  const credits = await query<Row>(`SELECT * FROM credits ${creditsWhere} ORDER BY created_at DESC LIMIT 80`, salesValues);
  const suspended = await query<Row>(`SELECT * FROM suspended_sales ${creditsWhere} ORDER BY slot ASC`, salesValues);
  const audit = await query<Row>("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 120");
  return { products, users, sales, credits, suspended, audit };
}

export async function createSale(input: {
  seller: User;
  items: CartItem[];
  payments: Payment[];
  discount: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}) {
  await ensureSchema();
  if (!input.items.length) throw new Error("Venda sem itens.");
  const subtotal = input.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const discount = Number(input.discount || 0);
  const total = Math.max(0, subtotal - discount);
  const isFiado = input.payments.some((payment) => payment.method === "fiado");
  const paid = input.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  if (!isFiado && paid < total) throw new Error("Pagamento incompleto.");
  if (isFiado && !input.customerName?.trim()) throw new Error("Informe o responsavel pelo fiado.");

  const sale = (
    await query<{ id: string; sale_number: number }>(
      `INSERT INTO sales (seller_id, seller_name, customer_name, customer_phone, subtotal, discount, total, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, sale_number`,
      [input.seller.id, input.seller.name, input.customerName || null, input.customerPhone || null, subtotal, discount, total, isFiado ? "fiado" : "paid", input.notes || null]
    )
  )[0];

  for (const item of input.items) {
    await query(
      "INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, weight, subtotal) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [sale.id, item.productId, item.productName, item.quantity, item.unitPrice, item.weight ?? null, item.subtotal]
    );
    await query("UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2", [item.quantity, item.productId]);
  }
  for (const payment of input.payments) {
    await query("INSERT INTO payments (sale_id, method, amount) VALUES ($1,$2,$3)", [sale.id, payment.method, payment.amount]);
  }
  if (isFiado) {
    await query(
      "INSERT INTO credits (sale_id, customer_name, customer_phone, seller_id, seller_name, amount, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [sale.id, input.customerName, input.customerPhone || null, input.seller.id, input.seller.name, total, input.notes || null]
    );
  }
  await query("INSERT INTO audit_logs (sale_id, user_id, user_name, type, origin, note) VALUES ($1,$2,$3,$4,$5,$6)", [
    sale.id,
    input.seller.id,
    input.seller.name,
    "sale_created",
    "pdv",
    `Venda #${sale.sale_number}`
  ]);
  return sale;
}
