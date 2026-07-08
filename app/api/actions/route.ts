import { NextResponse } from "next/server";
import { createSale, ensureSchema, productFromRow, query } from "@/lib/db";
import { demoAction, isDemoMode } from "@/lib/demo";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

function codeFromName(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "P");
  return `${base}${Date.now().toString().slice(-5)}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (isDemoMode()) {
      const result = await demoAction(body);
      return NextResponse.json({ ok: true, ...result, demo: true });
    }

    await ensureSchema();
    const action = String(body.action || "");
    const user = body.user as User;

    if (action === "createProduct") {
      const product = body.product || {};
      const rows = await query(
        `INSERT INTO products (name, category, barcode, internal_code, image_url, sale_price, cost_price, stock, unit, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          String(product.name || "Produto sem nome"),
          String(product.category || ""),
          product.barcode ? String(product.barcode) : null,
          product.internalCode || codeFromName(String(product.name || "Produto")),
          String(product.imageUrl || ""),
          Number(product.salePrice || 0),
          product.costPrice === "" || product.costPrice === null || product.costPrice === undefined ? null : Number(product.costPrice),
          Number(product.stock || 0),
          String(product.unit || "unidade"),
          product.active !== false
        ]
      );
      await query("INSERT INTO audit_logs (product_id, user_id, user_name, type, field, new_value, origin, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [
        rows[0].id,
        user?.id || null,
        user?.name || "Sistema",
        "product_created",
        "produto",
        String(product.name || ""),
        "estoque",
        "Produto cadastrado"
      ]);
      return NextResponse.json({ ok: true, product: productFromRow(rows[0]) });
    }

    if (action === "updateProduct") {
      const product = body.product || {};
      const before = (await query("SELECT * FROM products WHERE id = $1", [product.id]))[0];
      const rows = await query(
        `UPDATE products SET name=$2, category=$3, barcode=$4, image_url=$5, sale_price=$6, cost_price=$7, stock=$8, unit=$9, active=$10, updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [
          product.id,
          String(product.name || ""),
          String(product.category || ""),
          product.barcode ? String(product.barcode) : null,
          String(product.imageUrl || ""),
          Number(product.salePrice || 0),
          product.costPrice === "" || product.costPrice === null || product.costPrice === undefined ? null : Number(product.costPrice),
          Number(product.stock || 0),
          String(product.unit || "unidade"),
          product.active !== false
        ]
      );
      if (before && Number(before.sale_price) !== Number(product.salePrice)) {
        await query(
          "INSERT INTO audit_logs (product_id, user_id, user_name, type, field, old_value, new_value, origin, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [product.id, user?.id || null, user?.name || "Sistema", "price_changed", "sale_price", String(before.sale_price), String(product.salePrice), body.origin || "estoque", "Alteracao de preco"]
        );
      }
      return NextResponse.json({ ok: true, product: productFromRow(rows[0]) });
    }

    if (action === "createSale") {
      const sale = await createSale(body.sale);
      return NextResponse.json({ ok: true, sale });
    }

    if (action === "cancelSale") {
      const saleId = String(body.saleId || "");
      const sale = (await query("SELECT * FROM sales WHERE id=$1", [saleId]))[0];
      if (!sale) throw new Error("Venda nao encontrada.");
      if (user.role !== "manager" && String(sale.seller_id) !== user.id) throw new Error("Sem permissao para cancelar esta venda.");
      await query("UPDATE sales SET status='canceled', canceled_at=NOW(), canceled_by=$2, cancel_reason=$3 WHERE id=$1", [saleId, user.name, String(body.reason || "")]);
      await query("INSERT INTO audit_logs (sale_id, user_id, user_name, type, origin, note) VALUES ($1,$2,$3,$4,$5,$6)", [saleId, user.id, user.name, "sale_canceled", "historico", body.reason || "Venda cancelada"]);
      return NextResponse.json({ ok: true });
    }

    if (action === "settleCredit") {
      const credit = (await query("SELECT * FROM credits WHERE id=$1", [body.creditId]))[0];
      if (!credit) throw new Error("Fiado nao encontrado.");
      if (user.role !== "manager" && String(credit.seller_id) !== user.id) throw new Error("Sem permissao para quitar este fiado.");
      await query("UPDATE credits SET status='settled', settled_at=NOW(), settled_by=$2 WHERE id=$1", [body.creditId, user.name]);
      await query("INSERT INTO audit_logs (user_id, user_name, type, origin, note) VALUES ($1,$2,$3,$4,$5)", [user.id, user.name, "credit_settled", "fiado", `Fiado quitado: ${credit.customer_name}`]);
      return NextResponse.json({ ok: true });
    }

    if (action === "suspendSale") {
      const existing = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM suspended_sales WHERE seller_id=$1", [user.id]);
      const settings = await query<{ value: number }>("SELECT value FROM app_settings WHERE key='suspendedLimit'");
      const limit = Number(settings[0]?.value ?? 3);
      if (Number(existing[0]?.count ?? 0) >= limit) throw new Error(`Limite de ${limit} vendas minimizadas atingido.`);
      const slot = Number(existing[0]?.count ?? 0) + 1;
      await query("INSERT INTO suspended_sales (slot, seller_id, payload) VALUES ($1,$2,$3::jsonb)", [slot, user.id, JSON.stringify(body.payload || {})]);
      return NextResponse.json({ ok: true });
    }

    if (action === "removeSuspendedSale") {
      await query("DELETE FROM suspended_sales WHERE id=$1 AND ($2='manager' OR seller_id=$3)", [body.suspendedId, user.role, user.id]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Acao desconhecida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro na acao." }, { status: 500 });
  }
}
