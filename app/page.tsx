"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Edit3,
  Eye,
  FileText,
  History,
  Lock,
  LogIn,
  PackagePlus,
  Printer,
  ReceiptText,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Undo2,
  UserCircle,
  Users,
  WalletCards,
  Wifi,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CartItem, Payment, PaymentMethod, Product, Role, User } from "@/lib/types";

type AppState = {
  products: Product[];
  users: User[];
  sales: SaleRow[];
  credits: CreditRow[];
  suspended: SuspendedRow[];
  audit: AuditRow[];
};

type SaleRow = {
  id: string;
  sale_number: number;
  seller_id: string;
  seller_name: string;
  customer_name: string | null;
  subtotal: string;
  discount: string;
  total: string;
  status: string;
  created_at: string;
  items: CartItem[];
  payments: Payment[];
};

type CreditRow = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  seller_id: string;
  seller_name: string;
  amount: string;
  status: string;
  created_at: string;
};

type AuditRow = {
  id: string;
  user_name: string;
  type: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  origin: string;
  note: string | null;
  created_at: string;
};

type SuspendedRow = {
  id: string;
  slot: number;
  seller_id: string;
  payload: { cart: CartItem[]; discount: number; customerName: string; customerPhone: string };
  created_at: string;
};

const emptyProduct: Partial<Product> = {
  name: "",
  category: "Mercearia",
  barcode: "",
  internalCode: "",
  imageUrl: "",
  salePrice: 0,
  costPrice: null,
  stock: 0,
  unit: "unidade",
  active: true
};

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  debit: "Debito",
  credit_card: "Credito",
  pix: "Pix",
  other: "Outros",
  fiado: "Fiado"
};

const navItems: { key: string; label: string; icon: LucideIcon; managerOnly?: boolean }[] = [
  { key: "vendas", label: "Vendas", icon: ShoppingCart },
  { key: "estoque", label: "Estoque", icon: Archive },
  { key: "historico", label: "Historico", icon: History },
  { key: "fiado", label: "Fiado", icon: WalletCards },
  { key: "relatorios", label: "Relatorios", icon: BarChart3, managerOnly: true },
  { key: "usuarios", label: "Usuarios", icon: Users, managerOnly: true },
  { key: "auditoria", label: "Auditoria", icon: FileText, managerOnly: true }
];

function brl(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) }
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Erro inesperado.");
  return data;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("gerente@alameda.com");
  const [password, setPassword] = useState("123456");
  const [screen, setScreen] = useState("vendas");
  const [state, setState] = useState<AppState>({ products: [], users: [], sales: [], credits: [], suspended: [], audit: [] });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [productForm, setProductForm] = useState<Partial<Product>>(emptyProduct);
  const [quickOpen, setQuickOpen] = useState(false);
  const [wrongPriceOpen, setWrongPriceOpen] = useState(false);
  const [wrongPriceProductId, setWrongPriceProductId] = useState("");
  const [wrongPriceValue, setWrongPriceValue] = useState("");
  const [receiptSale, setReceiptSale] = useState<SaleRow | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [scanBuffer, setScanBuffer] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();
    return state.products.filter((product) => {
      const matchesCategory = category === "Todos" || product.category === category;
      const haystack = `${product.name} ${product.category} ${product.barcode} ${product.internalCode}`.toLowerCase();
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [category, search, state.products]);

  const categories = useMemo(() => ["Todos", ...Array.from(new Set(state.products.map((product) => product.category).filter(Boolean)))], [state.products]);
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const total = Math.max(0, subtotal - discount);
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);

  useEffect(() => {
    if (user) void loadState(user);
  }, [user]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (typing || !user) return;
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setScanBuffer((value) => `${value}${event.key}`);
        return;
      }
      if (event.key === "Enter" && scanBuffer.trim()) {
        event.preventDefault();
        handleScannedText(scanBuffer.trim());
        setScanBuffer("");
        return;
      }
      if (event.key === "F9") {
        event.preventDefault();
        setPaymentOpen(true);
      }
      if (event.key === "F4") {
        event.preventDefault();
        setSearch("");
        setQuickOpen(true);
      }
      if (event.key === "F7") {
        event.preventDefault();
        setWrongPriceOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scanBuffer, user, state.products]);

  useEffect(() => {
    if (!scanBuffer) return;
    const timeout = window.setTimeout(() => setScanBuffer(""), 900);
    return () => window.clearTimeout(timeout);
  }, [scanBuffer]);

  async function loadState(currentUser = user) {
    if (!currentUser) return;
    const data = await api(`/api/state?userId=${currentUser.id}&role=${currentUser.role}`);
    setState(data.state);
  }

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    try {
      setIsBusy(true);
      setMessage("Conectando ao banco...");
      await api("/api/bootstrap", { method: "POST", body: "{}" });
      const data = await api("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setUser(data.user);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no login.");
    } finally {
      setIsBusy(false);
    }
  }

  function addProduct(product: Product) {
    setCart((items) => {
      const existing = items.find((item) => item.productId === product.id);
      if (existing) {
        return items.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice } : item
        );
      }
      return [...items, { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.salePrice, subtotal: product.salePrice }];
    });
    if (product.stock <= 0) setMessage("Por favor, revisar estoque desse produto.");
  }

  function handleScannedText(value: string) {
    const term = value.toLowerCase();
    const exact = state.products.find((product) =>
      [product.barcode, product.internalCode, product.name].some((field) => field.toLowerCase() === term)
    );
    if (exact) {
      addProduct(exact);
      setMessage(`Produto adicionado: ${exact.name}`);
      return;
    }
    const matches = state.products.filter((product) => `${product.name} ${product.barcode} ${product.internalCode}`.toLowerCase().includes(term));
    if (matches.length === 1) {
      addProduct(matches[0]);
      setMessage(`Produto adicionado: ${matches[0].name}`);
      return;
    }
    if (matches.length > 1) {
      setSearch(value);
      setMessage(`${matches.length} produtos encontrados. Selecione na lista.`);
      return;
    }
    setProductForm({ ...emptyProduct, barcode: /^\d{6,}$/.test(value) ? value : "", name: /^\d{6,}$/.test(value) ? "" : value });
    setQuickOpen(true);
    setMessage("Produto nao cadastrado. Complete o cadastro rapido.");
  }

  function changeQty(productId: string, delta: number) {
    setCart((items) =>
      items
        .map((item) => {
          if (item.productId !== productId) return item;
          const quantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity, subtotal: quantity * item.unitPrice };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    try {
      setIsBusy(true);
      const action = productForm.id ? "updateProduct" : "createProduct";
      const data = await api("/api/actions", {
        method: "POST",
        body: JSON.stringify({ action, user, product: productForm })
      });
      setProductForm(emptyProduct);
      setQuickOpen(false);
      setMessage(productForm.id ? "Produto atualizado." : "Produto cadastrado.");
      await loadState();
      if (quickOpen && data.product) addProduct(data.product);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar produto.");
    } finally {
      setIsBusy(false);
    }
  }

  function addPayment() {
    const amount = Number(String(paymentAmount).replace(",", ".")) || remaining || total;
    setPayments((items) => [...items, { method: paymentMethod, amount }]);
    setPaymentAmount("");
  }

  async function finishSale() {
    if (!user) return;
    try {
      setIsBusy(true);
      const salePayments = payments.length ? payments : [{ method: paymentMethod, amount: total }];
      const result = await api("/api/actions", {
        method: "POST",
        body: JSON.stringify({
          action: "createSale",
          sale: {
            seller: user,
            items: cart,
            payments: salePayments,
            discount,
            customerName,
            customerPhone
          }
        })
      });
      const saleNumber = result.sale?.sale_number || result.sale?.saleNumber || Date.now();
      setReceiptSale({
        id: String(result.sale?.id || saleNumber),
        sale_number: Number(saleNumber),
        seller_id: user.id,
        seller_name: user.name,
        customer_name: customerName || null,
        subtotal: String(subtotal),
        discount: String(discount),
        total: String(total),
        status: paymentMethod === "fiado" ? "fiado" : "paid",
        created_at: new Date().toISOString(),
        items: cart,
        payments: salePayments
      });
      setCart([]);
      setPayments([]);
      setDiscount(0);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentOpen(false);
      setMessage("Venda concluida e registrada no banco.");
      await loadState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao finalizar venda.");
    } finally {
      setIsBusy(false);
    }
  }

  async function suspendSale() {
    if (!user || !cart.length) return;
    try {
      setIsBusy(true);
      await api("/api/actions", {
        method: "POST",
        body: JSON.stringify({ action: "suspendSale", user, payload: { cart, discount, customerName, customerPhone } })
      });
      setCart([]);
      setDiscount(0);
      setCustomerName("");
      setCustomerPhone("");
      setMessage("Venda minimizada no banco.");
      await loadState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao minimizar venda.");
    } finally {
      setIsBusy(false);
    }
  }

  async function restoreSuspendedSale(item: SuspendedRow) {
    if (!user) return;
    setIsBusy(true);
    setCart(item.payload.cart || []);
    setDiscount(item.payload.discount || 0);
    setCustomerName(item.payload.customerName || "");
    setCustomerPhone(item.payload.customerPhone || "");
    await api("/api/actions", { method: "POST", body: JSON.stringify({ action: "removeSuspendedSale", user, suspendedId: item.id }) });
    await loadState();
    setIsBusy(false);
  }

  async function cancelSale(saleId: string) {
    if (!user || !confirm("Cancelar esta venda?")) return;
    try {
      setIsBusy(true);
      await api("/api/actions", { method: "POST", body: JSON.stringify({ action: "cancelSale", user, saleId, reason: "Cancelado pelo operador" }) });
      await loadState();
      setMessage("Venda cancelada com registro de auditoria.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao cancelar venda.");
    } finally {
      setIsBusy(false);
    }
  }

  async function settleCredit(creditId: string) {
    if (!user) return;
    try {
      setIsBusy(true);
      await api("/api/actions", { method: "POST", body: JSON.stringify({ action: "settleCredit", user, creditId }) });
      await loadState();
      setMessage("Fiado quitado com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao quitar fiado.");
    } finally {
      setIsBusy(false);
    }
  }

  async function applyWrongPrice(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const product = state.products.find((item) => item.id === wrongPriceProductId);
    if (!product) {
      setMessage("Escolha o produto que esta com valor errado.");
      return;
    }
    const newPrice = Number(String(wrongPriceValue).replace(",", "."));
    try {
      setIsBusy(true);
      await api("/api/actions", {
        method: "POST",
        body: JSON.stringify({ action: "updateProduct", user, origin: "pdv", product: { ...product, salePrice: newPrice } })
      });
      setCart((items) => items.map((item) => item.productId === product.id ? { ...item, unitPrice: newPrice, subtotal: newPrice * item.quantity } : item));
      setWrongPriceOpen(false);
      setWrongPriceProductId("");
      setWrongPriceValue("");
      setMessage("Valor corrigido na venda, no estoque e na auditoria do produto.");
      await loadState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao corrigir valor.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-hero">
          <Image className="logo" src="/logo.png" alt="Mercadinho Alameda das Arvores" width={380} height={150} priority />
          <h1>
            Completo para o <span className="login-highlight">seu mercadinho</span>, simples para o dia a dia.
          </h1>
          <p className="muted">Vendas, estoque, fiado, auditoria, usuarios e relatorios em um PDV pronto para Vercel.</p>
          <div className="cards login-metrics">
            <div className="metric"><ShoppingCart /><span>Operacao</span><b>Rapida</b></div>
            <div className="metric"><ShieldCheck /><span>Controle</span><b>Seguro</b></div>
            <div className="metric"><Wifi /><span>Status</span><b>Online</b></div>
          </div>
        </section>
        <form className="login-card" onSubmit={onLogin}>
          <Image className="logo" src="/logo.png" alt="Mercadinho Alameda das Arvores" width={320} height={130} />
          <h2>Bem-vindo de volta</h2>
          <p className="muted">Use gerente@alameda.com ou vendedor@alameda.com. Senha: 123456.</p>
          <div className="field full">
            <label>Usuario</label>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field full field-gap">
            <label>Senha</label>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </div>
          <button className="primary full-width-action" disabled={isBusy} type="submit"><LogIn size={18} /> {isBusy ? "Entrando..." : "Entrar"}</button>
          {message && <p className={`notice app-alert ${isBusy ? "is-loading" : ""}`}>{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <Image className="logo" src="/logo.png" alt="Mercadinho Alameda das Arvores" width={190} height={90} priority />
        <nav className="nav">
          {navItems.map(({ key, label, icon: NavIcon, managerOnly }) => {
            if (managerOnly && user.role !== "manager") return null;
            return (
              <button key={key} className={screen === key ? "active" : ""} onClick={() => setScreen(key)}>
                <NavIcon size={20} /><span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="store-card">
          <b>Loja Matriz</b>
          <br />Alameda das Arvores, 123
          <br />Sistema em producao
        </div>
      </aside>
      <section className="main">
        <header className="topbar">
          <label className="search">
            <Search size={20} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produto, codigo de barras ou codigo interno..." />
            <span className="kbd">F2</span>
          </label>
          <div className="user-chip">
            <span className="avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
            <div><b>Caixa 01</b><br /><span className="muted">{user.name}</span> <span className="role">{user.role === "manager" ? "GERENTE" : "OPERADOR"}</span></div>
          </div>
          <div className="online"><Wifi size={18} /><span className="status-dot" />ONLINE</div>
        </header>
        <div className="content">
          {message && <p className={`notice app-alert ${isBusy ? "is-loading" : ""}`}>{message}</p>}
          {screen === "vendas" && renderSales()}
          {screen === "estoque" && renderInventory()}
          {screen === "historico" && renderHistory()}
          {screen === "fiado" && renderCredits()}
          {screen === "relatorios" && renderReports()}
          {screen === "usuarios" && renderUsers()}
          {screen === "auditoria" && renderAudit()}
        </div>
      </section>
      {paymentOpen && renderPaymentModal()}
      {quickOpen && renderQuickModal()}
      {wrongPriceOpen && renderWrongPriceModal()}
      {receiptSale && renderReceiptModal(receiptSale)}
      {selectedSale && renderSaleDetails(selectedSale)}
    </main>
  );

  function renderSales() {
    return (
      <section className="grid-sale">
        <div className="panel panel-pad">
          <div className="tabs">
            {categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <div className="scanner-strip">
            <Search size={18} />
            <span>{scanBuffer ? `Leitura: ${scanBuffer}` : "Leitor automatico pronto quando nenhum campo estiver ativo"}</span>
          </div>
          <div className="product-list">
            {filteredProducts.slice(0, 16).map((product) => (
              <button className="product-card" key={product.id} onClick={() => addProduct(product)}>
                <ProductPicture product={product} />
                <span>
                  <b>{product.name}</b><br />
                  <span className="muted">{product.category} · {product.barcode || product.internalCode}</span><br />
                  <span className={product.stock <= 0 ? "stock-low" : "muted"}>Estoque {product.stock} {product.unit}</span>
                </span>
                <span className="price">{brl(product.salePrice)}</span>
              </button>
            ))}
            {!filteredProducts.length && <EmptyState icon={Search} title="Nenhum produto encontrado" description="Revise a busca ou cadastre rapidamente um novo produto." />}
          </div>
          <button className="ghost full-width-action compact-action" onClick={() => setQuickOpen(true)}><PackagePlus size={18} /> Cadastro rapido F4</button>
        </div>
        <div className="panel">
          <div className="panel-pad panel-header">
            <h2 className="section-title"><ShoppingCart size={24} /> Venda em andamento</h2>
            <button className="ghost" disabled={isBusy || !cart.length} onClick={suspendSale}><Undo2 size={18} /> Minimizar venda</button>
          </div>
          <div className="table-wrap">
          <table className="cart-table">
            <thead><tr><th>#</th><th>Produto</th><th>Qtd.</th><th>Unit.</th><th>Subtotal</th><th /></tr></thead>
            <tbody>
              {cart.map((item, index) => (
                <tr key={item.productId}>
                  <td>{index + 1}</td>
                  <td>{item.productName}</td>
                  <td><span className="qty"><button onClick={() => changeQty(item.productId, -1)}>-</button><span>{item.quantity}</span><button onClick={() => changeQty(item.productId, 1)}>+</button></span></td>
                  <td>{brl(item.unitPrice)}</td>
                  <td>{brl(item.subtotal)}</td>
                  <td><button className="icon-btn" title="Remover item" onClick={() => changeQty(item.productId, -999)}><Trash2 size={16} /></button></td>
                </tr>
              ))}
                {!cart.length && (
                  <tr>
                    <td colSpan={6}><EmptyState icon={ShoppingCart} title="Venda vazia" description="Pesquise ou leia um codigo de barras para adicionar itens." /></td>
                  </tr>
                )}
            </tbody>
          </table>
          </div>
          <div className="panel-pad">
            <button className="warning" onClick={() => setWrongPriceOpen(true)}><Edit3 size={18} /> Produto com valor errado F7</button>
            <button className="ghost action-offset" disabled={!cart.length} onClick={() => confirm("Descartar esta venda?") && setCart([])}><Trash2 size={18} /> Descartar venda F8</button>
            <div className="mini-sales">
              {state.suspended.map((item) => <button className="ghost" key={item.id} onClick={() => restoreSuspendedSale(item)}>Venda {item.slot}<br />{brl((item.payload.cart || []).reduce((sum, row) => sum + row.subtotal, 0))}</button>)}
            </div>
          </div>
        </div>
        <aside className="panel panel-pad summary">
          <h3>Resumo</h3>
          <div className="summary-line"><span>Itens</span><strong>{cart.reduce((sum, item) => sum + item.quantity, 0)}</strong></div>
          <div className="summary-line"><span>Subtotal</span><strong>{brl(subtotal)}</strong></div>
          <label className="field"><label>Desconto</label><input value={discount} onChange={(event) => setDiscount(Number(event.target.value))} type="number" /></label>
          <div className="summary-line"><span>Total geral</span><strong className="total">{brl(total)}</strong></div>
          <div className="pay-grid">
            {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => (
              <button className={paymentMethod === method ? "active" : ""} key={method} onClick={() => setPaymentMethod(method)}>
                <PaymentIcon method={method} />{paymentLabels[method]}
              </button>
            ))}
          </div>
          <button className="primary" disabled={!cart.length} onClick={() => setPaymentOpen(true)}><CreditCard size={18} /> Forma de pagamento F9</button>
          <button className="ghost" disabled={isBusy || !cart.length} onClick={finishSale}><CheckCircle2 size={18} /> Finalizar venda F10</button>
        </aside>
      </section>
    );
  }

  function renderInventory() {
    return (
      <section className="split">
        <div className="panel panel-pad">
          <div className="panel-header">
            <div><h2 className="section-title">Gerenciamento de estoque</h2><p className="muted">Produtos com ou sem codigo de barras.</p></div>
            <button className="primary" onClick={() => setProductForm(emptyProduct)}><PackagePlus size={18} /> Novo produto</button>
          </div>
          <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Produto</th><th>Categoria</th><th>Codigos</th><th>Preco</th><th>Estoque</th><th>Status</th><th /></tr></thead>
            <tbody>{filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td><td>{product.category}</td><td>{product.barcode || "-"}<br /><span className="muted">{product.internalCode}</span></td>
                <td>{brl(product.salePrice)}</td><td className={product.stock <= 0 ? "stock-low" : ""}>{product.stock}</td><td><span className={product.active ? "badge" : "badge red"}>{product.active ? "Ativo" : "Inativo"}</span></td>
                <td><button className="icon-btn" title="Editar produto" onClick={() => setProductForm(product)}><Edit3 size={16} /></button></td>
              </tr>
            ))}
              {!filteredProducts.length && <tr><td colSpan={7}><EmptyState icon={Archive} title="Nenhum produto na lista" description="Use a busca global ou cadastre um novo produto." /></td></tr>}
            </tbody>
          </table>
          </div>
        </div>
        <ProductForm form={productForm} setForm={setProductForm} onSubmit={saveProduct} title={productForm.id ? "Editar produto" : "Cadastro de produto"} />
      </section>
    );
  }

  function renderHistory() {
    return (
      <section className="panel panel-pad">
        <h2 className="section-title"><History size={24} /> Historico de vendas</h2>
        <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Venda</th><th>Data</th><th>Vendedor</th><th>Total</th><th>Pagamento</th><th>Status</th><th>Acoes</th></tr></thead>
          <tbody>{state.sales.map((sale) => (
            <tr key={sale.id}>
              <td>#{sale.sale_number}</td><td>{dateTime(sale.created_at)}</td><td>{sale.seller_name}</td><td>{brl(sale.total)}</td>
              <td>{sale.payments?.map((payment) => paymentLabels[payment.method]).join(", ")}</td>
              <td><span className={sale.status === "canceled" ? "badge red" : sale.status === "fiado" ? "badge warn" : "badge"}>{sale.status}</span></td>
              <td className="row-actions">
                <button className="icon-btn" title="Detalhes" onClick={() => setSelectedSale(sale)}><Eye size={16} /></button>
                <button className="icon-btn" title="Recibo" onClick={() => setReceiptSale(sale)}><ReceiptText size={16} /></button>
                <button className="icon-btn" title="Cancelar" onClick={() => cancelSale(sale.id)}><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
            {!state.sales.length && <tr><td colSpan={7}><EmptyState icon={History} title="Nenhuma venda registrada" description="As vendas finalizadas aparecem aqui com recibo e detalhes." /></td></tr>}
          </tbody>
        </table>
        </div>
      </section>
    );
  }

  function renderCredits() {
    return (
      <section className="panel panel-pad">
        <h2 className="section-title"><WalletCards size={24} /> Fiado</h2>
        <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Responsavel</th><th>Telefone</th><th>Vendedor</th><th>Valor</th><th>Status</th><th /></tr></thead>
          <tbody>{state.credits.map((credit) => (
            <tr key={credit.id}>
              <td>{credit.customer_name}</td><td>{credit.customer_phone || "-"}</td><td>{credit.seller_name}</td><td>{brl(credit.amount)}</td>
              <td><span className={credit.status === "settled" ? "badge" : "badge warn"}>{credit.status}</span></td>
              <td>{credit.status !== "settled" && <button className="primary" onClick={() => settleCredit(credit.id)}><CheckCircle2 size={16} /> Quitar</button>}</td>
            </tr>
          ))}
            {!state.credits.length && <tr><td colSpan={6}><EmptyState icon={WalletCards} title="Nenhum fiado em aberto" description="Vendas fiado concluídas aparecem nesta tela." /></td></tr>}
          </tbody>
        </table>
        </div>
      </section>
    );
  }

  function renderReports() {
    const paidSales = state.sales.filter((sale) => sale.status !== "canceled");
    const revenue = paidSales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const avg = paidSales.length ? revenue / paidSales.length : 0;
    const creditTotal = state.credits.filter((credit) => credit.status !== "settled").reduce((sum, credit) => sum + Number(credit.amount), 0);
    const bars = [35, 62, 48, 71, 56, 82, 97];
    return (
      <section>
        <h2 className="section-title"><BarChart3 size={24} /> Relatorios gerenciais</h2>
        <div className="toolbar panel panel-pad">
          <button className="chip active"><CalendarDays size={16} /> Semanal</button>
          <button className="chip"><CalendarDays size={16} /> Mensal</button>
          <button className="chip"><CalendarDays size={16} /> Anual</button>
          <button className="chip"><Settings size={16} /> Personalizado</button>
        </div>
        <div className="cards">
          <div className="metric"><DollarSign /><span>Faturamento</span><b>{brl(revenue)}</b></div>
          <div className="metric"><ShoppingCart /><span>Vendas</span><b>{paidSales.length}</b></div>
          <div className="metric"><ReceiptText /><span>Ticket medio</span><b>{brl(avg)}</b></div>
          <div className="metric"><WalletCards /><span>Fiado pendente</span><b>{brl(creditTotal)}</b></div>
        </div>
        <div className="split">
          <div className="panel panel-pad">
            <h3>Desempenho da semana</h3>
            <div className="bar">{bars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
          </div>
          <div className="panel panel-pad">
            <h3>Insights do periodo</h3>
            <p className="notice">Pix e dinheiro concentram a maior parte dos pagamentos registrados.</p>
            <p className="notice">Existem {state.products.filter((product) => product.stock <= 0).length} produtos com estoque zerado ou negativo.</p>
            <p className="notice">Fiados pendentes somam {brl(creditTotal)} e merecem acompanhamento.</p>
          </div>
        </div>
      </section>
    );
  }

  function renderUsers() {
    return (
      <section className="panel panel-pad">
        <h2 className="section-title">Usuarios e permissoes</h2>
        <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Usuario</th><th>Email</th><th>Perfil</th><th>Status</th></tr></thead>
          <tbody>{state.users.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.role}</td><td><span className="badge">{item.active ? "Ativo" : "Inativo"}</span></td></tr>)}
            {!state.users.length && <tr><td colSpan={4}><EmptyState icon={Users} title="Nenhum usuario encontrado" description="Os usuarios autorizados aparecem nesta area." /></td></tr>}
          </tbody>
        </table>
        </div>
      </section>
    );
  }

  function renderAudit() {
    return (
      <section className="panel panel-pad">
        <h2 className="section-title">Auditoria geral</h2>
        <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Data</th><th>Usuario</th><th>Tipo</th><th>Campo</th><th>Antes</th><th>Depois</th><th>Origem</th></tr></thead>
          <tbody>{state.audit.map((item) => <tr key={item.id}><td>{dateTime(item.created_at)}</td><td>{item.user_name}</td><td>{item.type}</td><td>{item.field || "-"}</td><td>{item.old_value || "-"}</td><td>{item.new_value || item.note || "-"}</td><td>{item.origin}</td></tr>)}
            {!state.audit.length && <tr><td colSpan={7}><EmptyState icon={FileText} title="Nenhuma auditoria registrada" description="Alteracoes importantes do sistema aparecem aqui." /></td></tr>}
          </tbody>
        </table>
        </div>
      </section>
    );
  }

  function renderPaymentModal() {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <div className="panel-header"><h2>Forma de pagamento</h2><button className="ghost" onClick={() => setPaymentOpen(false)}>Fechar</button></div>
          <div className="split">
            <div>
              <label className="field full"><label>Observacao</label><textarea rows={3} placeholder="Observacao opcional" /></label>
              <h3>Itens do pedido ({cart.length})</h3>
              {cart.map((item) => <div className="product-card" key={item.productId}><span className="product-img">{item.quantity}x</span><span>{item.productName}<br /><span className="muted">{item.productId}</span></span><b>{brl(item.subtotal)}</b></div>)}
            </div>
            <div className="summary">
              <h3>Resumo do pedido</h3>
              <div className="summary-line"><span>Subtotal</span><strong>{brl(subtotal)}</strong></div>
              <div className="summary-line"><span>Desconto</span><strong>{brl(discount)}</strong></div>
              <div className="summary-line"><span>Total</span><strong className="total">{brl(total)}</strong></div>
              <div className="summary-line"><span>Ja pago</span><strong>{brl(paid)}</strong></div>
              <div className="summary-line"><span>Restante</span><strong>{brl(remaining)}</strong></div>
              {change > 0 && <p className="notice">Troco: {brl(change)}</p>}
              <div className="pay-grid">
                {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => <button key={method} className={paymentMethod === method ? "active" : ""} onClick={() => setPaymentMethod(method)}><PaymentIcon method={method} />{paymentLabels[method]}</button>)}
              </div>
              {paymentMethod === "fiado" && <>
                <label className="field"><label>Responsavel pelo fiado</label><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
                <label className="field"><label>Telefone</label><input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label>
              </>}
              <label className="field"><label>Valor recebido</label><input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={brl(remaining || total)} /></label>
              <button className="ghost" onClick={addPayment}><PackagePlus size={18} /> Adicionar forma de pagamento</button>
              <div className="pill-row">{payments.map((payment, index) => <span className="badge" key={index}>{paymentLabels[payment.method]} {brl(payment.amount)}</span>)}</div>
              <button className="primary" onClick={finishSale}><CheckCircle2 size={18} /> Concluir venda F10</button>
              <button className="warning" onClick={() => { void suspendSale(); setPaymentOpen(false); }}><Undo2 size={18} /> Minimizar venda F11</button>
              <button className="danger" onClick={() => { setCart([]); setPaymentOpen(false); }}><Trash2 size={18} /> Descartar venda F8</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderWrongPriceModal() {
    const selected = state.products.find((product) => product.id === wrongPriceProductId);
    return (
      <div className="modal-backdrop">
        <form className="modal modal-sm" onSubmit={applyWrongPrice}>
          <div className="panel-header">
            <h2><Edit3 size={24} /> Produto com valor errado</h2>
            <button type="button" className="ghost" onClick={() => setWrongPriceOpen(false)}><X size={18} /> Fechar</button>
          </div>
          <div className="form-grid">
            <label className="field full">
              <label>Item da venda</label>
              <select required value={wrongPriceProductId} onChange={(event) => {
                const product = state.products.find((item) => item.id === event.target.value);
                setWrongPriceProductId(event.target.value);
                setWrongPriceValue(product ? String(product.salePrice) : "");
              }}>
                <option value="">Selecione</option>
                {cart.map((item) => <option key={item.productId} value={item.productId}>{item.productName}</option>)}
              </select>
            </label>
            <div className="metric"><span>Valor atual</span><b>{selected ? brl(selected.salePrice) : "-"}</b></div>
            <label className="field">
              <label>Valor correto</label>
              <input required type="number" step="0.01" value={wrongPriceValue} onChange={(event) => setWrongPriceValue(event.target.value)} />
            </label>
          </div>
          <p className="notice">Ao salvar, o valor muda nesta venda, no estoque e gera auditoria individual do produto.</p>
          <button className="primary full-width-action"><Save size={18} /> Salvar correcao</button>
        </form>
      </div>
    );
  }

  function renderReceiptModal(sale: SaleRow) {
    return (
      <div className="modal-backdrop">
        <div className="modal receipt">
          <div className="panel-header">
            <h2><ReceiptText size={24} /> Recibo da venda #{sale.sale_number}</h2>
            <button className="ghost" onClick={() => setReceiptSale(null)}><X size={18} /> Fechar</button>
          </div>
          <div className="receipt-paper">
            <Image src="/logo.png" alt="Mercadinho Alameda das Arvores" width={220} height={90} />
            <p><b>Mercadinho Alameda das Arvores</b><br />Alameda das Arvores, 123<br />Venda #{sale.sale_number} - {dateTime(sale.created_at)}</p>
            <p>Vendedor: {sale.seller_name}</p>
            <table className="data-table">
              <thead><tr><th>Produto</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead>
              <tbody>{(sale.items || []).map((item) => <tr key={`${sale.id}-${item.productId}`}><td>{item.productName}</td><td>{item.quantity}</td><td>{brl(item.unitPrice)}</td><td>{brl(item.subtotal)}</td></tr>)}</tbody>
            </table>
            <div className="summary">
              <div className="summary-line"><span>Subtotal</span><strong>{brl(sale.subtotal)}</strong></div>
              <div className="summary-line"><span>Desconto</span><strong>{brl(sale.discount)}</strong></div>
              <div className="summary-line"><span>Total</span><strong className="total">{brl(sale.total)}</strong></div>
              <div className="summary-line"><span>Pagamento</span><strong>{sale.payments?.map((payment) => `${paymentLabels[payment.method]} ${brl(payment.amount)}`).join(" + ")}</strong></div>
            </div>
          </div>
          <div className="row-actions">
            <button className="primary" onClick={() => window.print()}><Printer size={18} /> Imprimir</button>
            <button className="ghost" onClick={() => setReceiptSale(null)}><ShoppingCart size={18} /> Nova venda</button>
          </div>
        </div>
      </div>
    );
  }

  function renderSaleDetails(sale: SaleRow) {
    return (
      <div className="modal-backdrop">
        <div className="modal modal-md">
          <div className="panel-header">
            <h2><Eye size={24} /> Detalhes da venda #{sale.sale_number}</h2>
            <button className="ghost" onClick={() => setSelectedSale(null)}><X size={18} /> Fechar</button>
          </div>
          <div className="cards three-cards">
            <div className="metric"><Clock3 /><span>Data</span><b>{dateTime(sale.created_at)}</b></div>
            <div className="metric"><UserCircle /><span>Vendedor</span><b>{sale.seller_name}</b></div>
            <div className="metric"><DollarSign /><span>Total</span><b>{brl(sale.total)}</b></div>
          </div>
          <table className="data-table">
            <thead><tr><th>Item</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead>
            <tbody>{(sale.items || []).map((item) => <tr key={item.productId}><td>{item.productName}</td><td>{item.quantity}</td><td>{brl(item.unitPrice)}</td><td>{brl(item.subtotal)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderQuickModal() {
    return (
      <div className="modal-backdrop">
        <div className="modal modal-xs">
          <div className="panel-header"><h2>Cadastro rapido</h2><button className="ghost" onClick={() => setQuickOpen(false)}>Fechar</button></div>
          <ProductForm form={productForm} setForm={setProductForm} onSubmit={saveProduct} title="Produto novo" compact />
        </div>
      </div>
    );
  }
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Icon size={22} /></span>
      <div>
        <b>{title}</b>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ProductPicture({ product }: { product: Product }) {
  if (product.imageUrl) return <img className="product-img" src={product.imageUrl} alt={product.name} />;
  return <span className="product-img">{product.name.slice(0, 2).toUpperCase()}</span>;
}

function PaymentIcon({ method }: { method: PaymentMethod }) {
  if (method === "cash") return <DollarSign size={24} />;
  if (method === "debit") return <CreditCard size={24} />;
  if (method === "credit_card") return <WalletCards size={24} />;
  if (method === "pix") return <Box size={24} />;
  if (method === "fiado") return <Users size={24} />;
  return <Settings size={24} />;
}

function ProductForm({
  form,
  setForm,
  onSubmit,
  title,
  compact = false
}: {
  form: Partial<Product>;
  setForm: (value: Partial<Product>) => void;
  onSubmit: (event: FormEvent) => void;
  title: string;
  compact?: boolean;
}) {
  function update(key: keyof Product, value: string | number | boolean | null) {
    setForm({ ...form, [key]: value });
  }

  return (
    <form className="panel panel-pad" onSubmit={onSubmit}>
      <h3>{title}</h3>
      <div className="form-grid">
        <label className="field full"><label>Nome do produto</label><input required value={form.name || ""} onChange={(event) => update("name", event.target.value)} /></label>
        {!compact && <label className="field"><label>Categoria</label><input value={form.category || ""} onChange={(event) => update("category", event.target.value)} /></label>}
        <label className="field"><label>Codigo de barras opcional</label><input value={form.barcode || ""} onChange={(event) => update("barcode", event.target.value)} /></label>
        {!compact && <label className="field"><label>Codigo interno</label><input placeholder="Automatico se vazio" value={form.internalCode || ""} onChange={(event) => update("internalCode", event.target.value)} /></label>}
        <label className="field"><label>Preco de venda</label><input type="number" step="0.01" value={form.salePrice ?? 0} onChange={(event) => update("salePrice", Number(event.target.value))} /></label>
        {!compact && <label className="field"><label>Preco de custo</label><input type="number" step="0.01" value={form.costPrice ?? ""} onChange={(event) => update("costPrice", event.target.value ? Number(event.target.value) : null)} /></label>}
        {!compact && <label className="field"><label>Estoque atual</label><input type="number" step="0.001" value={form.stock ?? 0} onChange={(event) => update("stock", Number(event.target.value))} /></label>}
        {!compact && <label className="field"><label>Unidade</label><select value={form.unit || "unidade"} onChange={(event) => update("unit", event.target.value)}><option>unidade</option><option>peso</option><option>pacote</option></select></label>}
        {!compact && <label className="field full"><label>URL da imagem opcional</label><input value={form.imageUrl || ""} onChange={(event) => update("imageUrl", event.target.value)} /></label>}
      </div>
      <button className="primary full-width-action form-submit-action">Salvar produto</button>
    </form>
  );
}
