export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export type BillingScope = {
  tenantId: string;
  projectId: string;
};

export type BillingConfig = BillingScope & {
  defaultWallet?: string;
};

export type GrantInput = {
  customerId: string;
  amount: number;
  idempotencyKey: string;
  wallet?: string;
  source?: string;
  validFrom?: Date;
  expiresAt?: Date;
  description?: string;
  metadata?: Readonly<Record<string, JsonValue>>;
};

export type GrantResult = {
  grantId: string;
  customerId: string;
  wallet: string;
  source: string;
  amount: number;
  available: number;
  validFrom: Date | null;
  expiresAt: Date | null;
  replayed: boolean;
};

export type ReserveInput = {
  customerId: string;
  amount: number;
  transactionId: string;
  wallet?: string;
  autoReleaseAfterSeconds?: number;
  autoSettleAfterSeconds?: number;
  description?: string;
  metadata?: Readonly<Record<string, JsonValue>>;
};

export type Allocation = {
  grantId: string;
  source: string;
  amount: number;
};

export type ReservationStatus = "RESERVED" | "SETTLED" | "RELEASED";

export type ReservationResult = {
  reservationId: string;
  transactionId: string;
  customerId: string;
  wallet: string;
  status: ReservationStatus;
  reservedAmount: number;
  settledAmount: number;
  releasedAmount: number;
  allocations: Allocation[];
  automaticAction: "SETTLE" | "RELEASE" | null;
  automaticActionAt: Date | null;
  replayed: boolean;
};

export type SettleInput = {
  transactionId: string;
  actualAmount: number;
};

export type ReleaseInput = {
  transactionId: string;
};

export type GetBalanceInput = {
  customerId: string;
  wallet?: string;
};

export type GrantBalance = {
  grantId: string;
  source: string;
  total: number;
  used: number;
  reserved: number;
  available: number;
  validFrom: Date | null;
  expiresAt: Date | null;
};

export type BalanceResult = {
  customerId: string;
  wallet: string;
  total: number;
  used: number;
  reserved: number;
  available: number;
  grants: GrantBalance[];
};

export type LedgerOperation = "GRANT" | "RESERVE" | "SETTLE" | "RELEASE";

export type ListLedgerInput = {
  customerId?: string;
  wallet?: string;
  transactionId?: string;
  limit?: number;
  before?: Date;
};

export type LedgerEntry = {
  id: string;
  customerId: string;
  wallet: string;
  source: string;
  transactionId: string;
  operation: LedgerOperation;
  amount: number;
  description: string | null;
  metadata: Readonly<Record<string, JsonValue>> | null;
  createdAt: Date;
};

export type LedgerResult = {
  entries: LedgerEntry[];
  nextBefore: Date | null;
};

export interface Billing {
  grant(input: GrantInput): Promise<GrantResult>;
  reserve(input: ReserveInput): Promise<ReservationResult>;
  settle(input: SettleInput): Promise<ReservationResult>;
  release(input: ReleaseInput): Promise<ReservationResult>;
  getBalance(input: GetBalanceInput): Promise<BalanceResult>;
  listLedger(input?: ListLedgerInput): Promise<LedgerResult>;
}
