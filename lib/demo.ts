import { hashPassword } from "./db";
import type { CartItem, Payment, Product, User } from "./types";

type DemoSale = {
  id: string;
  sale_number: number;
  seller_id: string;
  seller_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: string;
  discount: string;
  total: string;
  status: string;
  notes: string | null;
  created_at: string;
  items: CartItem[];
  payments: Payment[];
};

type DemoCredit = {
  id: string;
  sale_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  seller_id: string;
  seller_name: string;
  amount: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type DemoAudit = {
  id: string;
  product_id: string | null;
  sale_id: string | null;
  user_name: string;
  type: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  origin: string;
  note: string | null;
  created_at: string;
};

type DemoSuspended = {
  id: string;
  slot: number;
  seller_id: string;
  payload: unknown;
  created_at: string;
};

const users: User[] = [
  { id: "usr-manager", name: "Ana Paula", email: "gerente@alameda.com", role: "manager", active: true },
  { id: "usr-seller", name: "Joao Silva", email: "vendedor@alameda.com", role: "seller", active: true }
];

let products: Product[] = [
  { id: "prd-1", name: "Arroz Tio Joao 5kg", category: "Mercearia", barcode: "7891234567895", internalCode: "ARR0001", imageUrl: "", salePrice: 29.9, costPrice: 22.5, stock: 42, unit: "pacote", active: true },
  { id: "prd-2", name: "Feijao Carioca Kicaldo 1kg", category: "Mercearia", barcode: "7896058501234", internalCode: "FEI0002", imageUrl: "", salePrice: 7.49, costPrice: 5.2, stock: 35, unit: "unidade", active: true },
  { id: "prd-3", name: "Oleo de Soja Liza 900ml", category: "Mercearia", barcode: "7896021300057", internalCode: "OLE0003", imageUrl: "", salePrice: 6.49, costPrice: 4.95, stock: 28, unit: "unidade", active: true },
  { id: "prd-4", name: "Leite Integral Italac 1L", category: "Laticinios", barcode: "7898087702198", internalCode: "LEI0004", imageUrl: "", salePrice: 4.99, costPrice: 3.75, stock: 18, unit: "unidade", active: true },
  { id: "prd-5", name: "Cafe Pilao Tradicional 500g", category: "Mercearia", barcode: "7891025100127", internalCode: "CAF0005", imageUrl: "", salePrice: 16.9, costPrice: 12.4, stock: 30, unit: "pacote", active: true },
  { id: "prd-6", name: "Acucar Refinado Uniao 1kg", category: "Mercearia", barcode: "7891039000210", internalCode: "ACU0006", imageUrl: "", salePrice: 4.49, costPrice: 3.1, stock: 50, unit: "unidade", active: true }
];

let sales: DemoSale[] = [];
let credits: DemoCredit[] = [];
let audit: DemoAudit[] = [];
let suspended: DemoSuspended[] = [];
let saleNumber = 12560;

export function isDemoMode() {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  const isVercel = Boolean(process.env.VERCEL);
  return !isVercel && !hasDatabase;
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function auditLog(entry: Omit<DemoAudit, "id" | "created_at">) {
  audit.unshift({ ...entry, id: id("aud"), created_at: new Date().toISOString() });
}

export async function demoLogin(email: string, password: string) {
  if (hashPassword(password) !== hashPassword("123456")) return null;
  return users.find((user) => user.email === email && user.active) || null;
}

export async function demoState(userId?: string, role?: string) {
  const ownSales = role === "seller" ? sales.filter((sale) => sale.seller_id === userId) : sales;
  const ownCredits = role === "seller" ? credits.filter((credit) => credit.seller_id === userId) : credits;
  const ownSuspended = role === "seller" ? suspended.filter((item) => item.seller_id === userId) : suspended;
  return { products, users, sales: ownSales, credits: ownCredits, suspended: ownSuspended, audit };
}

export async function demoAction(body: Record<string, any>) {
  const action = String(body.action || "");
  const user = body.user as User;

  if (action === "createProduct") {
    const source = body.product || {};
    const product: Product = {
      id: id("prd"),
      name: String(source.name || "Produto sem nome"),
      category: String(source.category || "Mercearia"),
      barcode: String(source.barcode || ""),
      internalCode: String(source.internalCode || `PRO${Date.now().toString().slice(-5)}`),
      imageUrl: String(source.imageUrl || ""),
      salePrice: Number(source.salePrice || 0),
      costPrice: source.costPrice === null || source.costPrice === "" || source.costPrice === undefined ? null : Number(source.costPrice),
      stock: Number(source.stock || 0),
      unit: String(source.unit || "unidade"),
      active: source.active !== false
    };
    products = [product, ...products];
    auditLog({ product_id: product.id, sale_id: null, user_name: user?.name || "Sistema", type: "product_created", field: "produto", old_value: null, new_value: product.name, origin: "estoque", note: "Produto cadastrado em modo teste" });
    return { product };
  }

  if (action === "updateProduct") {
    const source = body.product || {};
    const before = products.find((product) => product.id === source.id);
    if (!before) throw new Error("Produto nao encontrado.");
    const updated: Product = { ...before, ...source, salePrice: Number(source.salePrice || 0), stock: Number(source.stock || 0), active: source.active !== false };
    products = products.map((product) => (product.id === updated.id ? updated : product));
    if (before.salePrice !== updated.salePrice) {
      auditLog({ product_id: updated.id, sale_id: null, user_name: user?.name || "Sistema", type: "price_changed", field: "sale_price", old_value: String(before.salePrice), new_value: String(updated.salePrice), origin: "estoque", note: "Alteracao de preco em modo teste" });
    }
    return { product: updated };
  }

  if (action === "createSale") {
    const saleInput = body.sale || {};
    const items = (saleInput.items || []) as CartItem[];
    if (!items.length) throw new Error("Venda sem itens.");
    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const discount = Number(saleInput.discount || 0);
    const total = Math.max(0, subtotal - discount);
    const payments = (saleInput.payments || []) as Payment[];
    const isFiado = payments.some((payment) => payment.method === "fiado");
    if (isFiado && !String(saleInput.customerName || "").trim()) throw new Error("Informe o responsavel pelo fiado.");

    const sale: DemoSale = {
      id: id("sal"),
      sale_number: ++saleNumber,
      seller_id: saleInput.seller.id,
      seller_name: saleInput.seller.name,
      customer_name: saleInput.customerName || null,
      customer_phone: saleInput.customerPhone || null,
      subtotal: String(subtotal),
      discount: String(discount),
      total: String(total),
      status: isFiado ? "fiado" : "paid",
      notes: saleInput.notes || null,
      created_at: new Date().toISOString(),
      items,
      payments
    };
    sales.unshift(sale);
    products = products.map((product) => {
      const item = items.find((cartItem) => cartItem.productId === product.id);
      return item ? { ...product, stock: product.stock - item.quantity } : product;
    });
    if (isFiado) {
      credits.unshift({ id: id("cre"), sale_id: sale.id, customer_name: String(saleInput.customerName), customer_phone: saleInput.customerPhone || null, seller_id: sale.seller_id, seller_name: sale.seller_name, amount: String(total), status: "open", notes: sale.notes, created_at: sale.created_at });
    }
    auditLog({ product_id: null, sale_id: sale.id, user_name: sale.seller_name, type: "sale_created", field: null, old_value: null, new_value: null, origin: "pdv", note: `Venda #${sale.sale_number} em modo teste` });
    return { sale };
  }

  if (action === "cancelSale") {
    const sale = sales.find((item) => item.id === body.saleId);
    if (!sale) throw new Error("Venda nao encontrada.");
    if (user.role !== "manager" && sale.seller_id !== user.id) throw new Error("Sem permissao para cancelar esta venda.");
    sale.status = "canceled";
    auditLog({ product_id: null, sale_id: sale.id, user_name: user.name, type: "sale_canceled", field: null, old_value: null, new_value: null, origin: "historico", note: "Venda cancelada em modo teste" });
    return {};
  }

  if (action === "settleCredit") {
    const credit = credits.find((item) => item.id === body.creditId);
    if (!credit) throw new Error("Fiado nao encontrado.");
    if (user.role !== "manager" && credit.seller_id !== user.id) throw new Error("Sem permissao para quitar este fiado.");
    credit.status = "settled";
    auditLog({ product_id: null, sale_id: credit.sale_id, user_name: user.name, type: "credit_settled", field: null, old_value: "open", new_value: "settled", origin: "fiado", note: credit.customer_name });
    return {};
  }

  if (action === "suspendSale") {
    const own = suspended.filter((item) => item.seller_id === user.id);
    if (own.length >= 3) throw new Error("Limite de 3 vendas minimizadas atingido.");
    suspended.push({ id: id("sus"), slot: own.length + 1, seller_id: user.id, payload: body.payload || {}, created_at: new Date().toISOString() });
    return {};
  }

  if (action === "removeSuspendedSale") {
    suspended = suspended.filter((item) => item.id !== body.suspendedId || (user.role !== "manager" && item.seller_id !== user.id));
    return {};
  }

  throw new Error("Acao desconhecida.");
}
