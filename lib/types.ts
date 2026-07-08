export type Role = "manager" | "seller";
export type PaymentMethod = "cash" | "debit" | "credit_card" | "pix" | "other" | "fiado";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  barcode: string;
  internalCode: string;
  imageUrl: string;
  salePrice: number;
  costPrice: number | null;
  stock: number;
  unit: string;
  active: boolean;
};

export type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  weight?: number;
  subtotal: number;
};

export type Payment = {
  method: PaymentMethod;
  amount: number;
};
