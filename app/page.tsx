"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const [message, setMessage] = useState("");
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
      if (event.key === "F9") {
        event.preventDefault();
        setPaymentOpen(true);
      }
      if (event.key === "F4") {
        event.preventDefault();
        setSearch("");
        setQuickOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [user]);

  async function loadState(currentUser = user) {
    if (!currentUser) return;
    const data = await api(`/api/state?userId=${currentUser.id}&role=${currentUser.role}`);
    setState(data.state);
  }

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    try {
      setMessage("Conectando ao banco...");
      await api("/api/bootstrap", { method: "POST", body: "{}" });
      const data = await api("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setUser(data.user);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha no login.");
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
  }

  function addPayment() {
    const amount = Number(String(paymentAmount).replace(",", ".")) || remaining || total;
    setPayments((items) => [...items, { method: paymentMethod, amount }]);
    setPaymentAmount("");
  }

  async function finishSale() {
    if (!user) return;
    try {
      const salePayments = payments.length ? payments : [{ method: paymentMethod, amount: total }];
      await api("/api/actions", {
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
    }
  }

  async function suspendSale() {
    if (!user || !cart.length) return;
    try {
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
    }
  }

  async function restoreSuspendedSale(item: SuspendedRow) {
    if (!user) return;
    setCart(item.payload.cart || []);
    setDiscount(item.payload.discount || 0);
    setCustomerName(item.payload.customerName || "");
    setCustomerPhone(item.payload.customerPhone || "");
    await api("/api/actions", { method: "POST", body: JSON.stringify({ action: "removeSuspendedSale", user, suspendedId: item.id }) });
    await loadState();
  }

  async function cancelSale(saleId: string) {
    if (!user || !confirm("Cancelar esta venda?")) return;
    await api("/api/actions", { method: "POST", body: JSON.stringify({ action: "cancelSale", user, saleId, reason: "Cancelado pelo operador" }) });
    await loadState();
  }

  async function settleCredit(creditId: string) {
    if (!user) return;
    await api("/api/actions", { method: "POST", body: JSON.stringify({ action: "settleCredit", user, creditId }) });
    await loadState();
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-hero">
          <Image className="logo" src="/logo.png" alt="Mercadinho Alameda das Arvores" width={380} height={150} priority />
          <h1>
            Completo para o <span style={{ color: "var(--green)" }}>seu mercadinho</span>, simples para o dia a dia.
          </h1>
          <p className="muted">Vendas, estoque, fiado, auditoria, usuarios e relatorios em um PDV pronto para Vercel.</p>
          <div className="cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="metric"><span>Operacao</span><b>Rapida</b></div>
            <div className="metric"><span>Controle</span><b>Seguro</b></div>
            <div className="metric"><span>Status</span><b>Online</b></div>
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
          <div className="field full" style={{ marginTop: 12 }}>
            <label>Senha</label>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </div>
          <button className="primary" style={{ width: "100%", marginTop: 18 }} type="submit">Entrar</button>
          {message && <p className="notice">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <Image className="logo" src="/logo.png" alt="Mercadinho Alameda das Arvores" width={190} height={90} priority />
        <nav className="nav">
          {[
            ["vendas", "Vendas"],
            ["estoque", "Estoque"],
            ["historico", "Historico"],
            ["fiado", "Fiado"],
            ["relatorios", "Relatorios"],
            ["usuarios", "Usuarios"],
            ["auditoria", "Auditoria"]
          ].map(([key, label]) => {
            if (["usuarios", "relatorios", "auditoria"].includes(key) && user.role !== "manager") return null;
            return (
              <button key={key} className={screen === key ? "active" : ""} onClick={() => setScreen(key)}>
                <span>{label.slice(0, 2)}</span><span>{label}</span>
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
            <span>Buscar</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produto, codigo de barras ou codigo interno..." />
            <span className="kbd">F2</span>
          </label>
          <div className="user-chip">
            <span className="avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
            <div><b>Caixa 01</b><br /><span className="muted">{user.name}</span> <span className="role">{user.role === "manager" ? "GERENTE" : "OPERADOR"}</span></div>
          </div>
          <div className="online"><span className="status-dot" />ONLINE</div>
        </header>
        <div className="content">
          {message && <p className="notice">{message}</p>}
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
    </main>
  );

  function renderSales() {
    return (
      <section className="grid-sale">
        <div className="panel panel-pad">
          <div className="tabs">
            {categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
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
          </div>
          <button className="ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => setQuickOpen(true)}>Cadastro rapido F4</button>
        </div>
        <div className="panel">
          <div className="panel-pad row-actions" style={{ justifyContent: "space-between" }}>
            <h2 className="section-title">Venda em andamento</h2>
            <button className="ghost" onClick={suspendSale}>Minimizar venda</button>
          </div>
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
                  <td><button className="icon-btn" onClick={() => changeQty(item.productId, -999)}>X</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="panel-pad">
            <button className="warning" onClick={() => setScreen("estoque")}>Produto com valor errado F7</button>
            <button className="ghost" style={{ marginLeft: 10 }} onClick={() => setCart([])}>Descartar venda F8</button>
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
              <button className={paymentMethod === method ? "active" : ""} key={method} onClick={() => setPaymentMethod(method)}>{paymentLabels[method]}</button>
            ))}
          </div>
          <button className="primary" onClick={() => setPaymentOpen(true)}>Forma de pagamento F9</button>
          <button className="ghost" onClick={finishSale}>Finalizar venda F10</button>
        </aside>
      </section>
    );
  }

  function renderInventory() {
    return (
      <section className="split">
        <div className="panel panel-pad">
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <div><h2 className="section-title">Gerenciamento de estoque</h2><p className="muted">Produtos com ou sem codigo de barras.</p></div>
            <button className="primary" onClick={() => setProductForm(emptyProduct)}>Novo produto</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Produto</th><th>Categoria</th><th>Codigos</th><th>Preco</th><th>Estoque</th><th>Status</th><th /></tr></thead>
            <tbody>{filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td><td>{product.category}</td><td>{product.barcode || "-"}<br /><span className="muted">{product.internalCode}</span></td>
                <td>{brl(product.salePrice)}</td><td>{product.stock}</td><td><span className={product.active ? "badge" : "badge red"}>{product.active ? "Ativo" : "Inativo"}</span></td>
                <td><button className="icon-btn" onClick={() => setProductForm(product)}>Editar</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <ProductForm form={productForm} setForm={setProductForm} onSubmit={saveProduct} title={productForm.id ? "Editar produto" : "Cadastro de produto"} />
      </section>
    );
  }

  function renderHistory() {
    return (
      <section className="panel panel-pad">
        <h2 className="section-title">Historico de vendas</h2>
        <table className="data-table">
          <thead><tr><th>Venda</th><th>Data</th><th>Vendedor</th><th>Total</th><th>Pagamento</th><th>Status</th><th /></tr></thead>
          <tbody>{state.sales.map((sale) => (
            <tr key={sale.id}>
              <td>#{sale.sale_number}</td><td>{dateTime(sale.created_at)}</td><td>{sale.seller_name}</td><td>{brl(sale.total)}</td>
              <td>{sale.payments?.map((payment) => paymentLabels[payment.method]).join(", ")}</td>
              <td><span className={sale.status === "canceled" ? "badge red" : sale.status === "fiado" ? "badge warn" : "badge"}>{sale.status}</span></td>
              <td><button className="icon-btn" onClick={() => cancelSale(sale.id)}>Cancelar</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    );
  }

  function renderCredits() {
    return (
      <section className="panel panel-pad">
        <h2 className="section-title">Fiado</h2>
        <table className="data-table">
          <thead><tr><th>Responsavel</th><th>Telefone</th><th>Vendedor</th><th>Valor</th><th>Status</th><th /></tr></thead>
          <tbody>{state.credits.map((credit) => (
            <tr key={credit.id}>
              <td>{credit.customer_name}</td><td>{credit.customer_phone || "-"}</td><td>{credit.seller_name}</td><td>{brl(credit.amount)}</td>
              <td><span className={credit.status === "settled" ? "badge" : "badge warn"}>{credit.status}</span></td>
              <td>{credit.status !== "settled" && <button className="primary" onClick={() => settleCredit(credit.id)}>Quitar</button>}</td>
            </tr>
          ))}</tbody>
        </table>
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
        <h2 className="section-title">Relatorios gerenciais</h2>
        <div className="cards">
          <div className="metric"><span>Faturamento</span><b>{brl(revenue)}</b></div>
          <div className="metric"><span>Vendas</span><b>{paidSales.length}</b></div>
          <div className="metric"><span>Ticket medio</span><b>{brl(avg)}</b></div>
          <div className="metric"><span>Fiado pendente</span><b>{brl(creditTotal)}</b></div>
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
        <table className="data-table">
          <thead><tr><th>Usuario</th><th>Email</th><th>Perfil</th><th>Status</th></tr></thead>
          <tbody>{state.users.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.role}</td><td><span className="badge">{item.active ? "Ativo" : "Inativo"}</span></td></tr>)}</tbody>
        </table>
      </section>
    );
  }

  function renderAudit() {
    return (
      <section className="panel panel-pad">
        <h2 className="section-title">Auditoria geral</h2>
        <table className="data-table">
          <thead><tr><th>Data</th><th>Usuario</th><th>Tipo</th><th>Campo</th><th>Antes</th><th>Depois</th><th>Origem</th></tr></thead>
          <tbody>{state.audit.map((item) => <tr key={item.id}><td>{dateTime(item.created_at)}</td><td>{item.user_name}</td><td>{item.type}</td><td>{item.field || "-"}</td><td>{item.old_value || "-"}</td><td>{item.new_value || item.note || "-"}</td><td>{item.origin}</td></tr>)}</tbody>
        </table>
      </section>
    );
  }

  function renderPaymentModal() {
    return (
      <div className="modal-backdrop">
        <div className="modal">
          <div className="row-actions" style={{ justifyContent: "space-between" }}><h2>Forma de pagamento</h2><button className="ghost" onClick={() => setPaymentOpen(false)}>Fechar</button></div>
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
                {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => <button key={method} className={paymentMethod === method ? "active" : ""} onClick={() => setPaymentMethod(method)}>{paymentLabels[method]}</button>)}
              </div>
              {paymentMethod === "fiado" && <>
                <label className="field"><label>Responsavel pelo fiado</label><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
                <label className="field"><label>Telefone</label><input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label>
              </>}
              <label className="field"><label>Valor recebido</label><input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={brl(remaining || total)} /></label>
              <button className="ghost" onClick={addPayment}>Adicionar forma de pagamento</button>
              <div>{payments.map((payment, index) => <span className="badge" key={index} style={{ marginRight: 8 }}>{paymentLabels[payment.method]} {brl(payment.amount)}</span>)}</div>
              <button className="primary" onClick={finishSale}>Concluir venda F10</button>
              <button className="warning" onClick={() => { void suspendSale(); setPaymentOpen(false); }}>Minimizar venda F11</button>
              <button className="danger" onClick={() => { setCart([]); setPaymentOpen(false); }}>Descartar venda F8</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderQuickModal() {
    return (
      <div className="modal-backdrop">
        <div className="modal" style={{ maxWidth: 560 }}>
          <div className="row-actions" style={{ justifyContent: "space-between" }}><h2>Cadastro rapido</h2><button className="ghost" onClick={() => setQuickOpen(false)}>Fechar</button></div>
          <ProductForm form={productForm} setForm={setProductForm} onSubmit={saveProduct} title="Produto novo" compact />
        </div>
      </div>
    );
  }
}

function ProductPicture({ product }: { product: Product }) {
  if (product.imageUrl) return <img className="product-img" src={product.imageUrl} alt={product.name} />;
  return <span className="product-img">{product.name.slice(0, 2).toUpperCase()}</span>;
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
      <button className="primary" style={{ width: "100%", marginTop: 14 }}>Salvar produto</button>
    </form>
  );
}
