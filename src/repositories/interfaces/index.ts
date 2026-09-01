import {
  Team,
  User,
  Contact,
  ContactAllocation,
  CallLog,
  Customer,
  Order,
  DeliveryStatusHistory,
  ActivityLog,
  ExpenseCategory,
  Expense,
  EmailNotification,
  UserRole,
  ContactStatus,
  Product,
  StockActivityLog,
  ApprovalRequest,
  PettyCashWallet,
  PettyCashTransaction,
  ApprovalStatus,
  TeamSalesTarget,
  TeamTargetTier,
  DuplicatePhoneCheckResult,
} from '../../models/domain';

export interface ITeamRepository {
  getAll(): Promise<Team[]>;
  getById(id: string): Promise<Team | null>;
}

export interface IUserRepository {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  getByRole(role: UserRole): Promise<User[]>;
  getByTeamId(teamId: string): Promise<User[]>;
  getBySupervisorId(supervisorId: string): Promise<User[]>;
  create(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
  update(id: string, updates: Partial<User>): Promise<User>;
  updateMe(updates: Partial<User>): Promise<User>;
  disable(id: string): Promise<void>;
}

export interface IContactRepository {
  getAll(): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  getByTeamId(teamId: string): Promise<Contact[]>;
  getByMemberId(memberId: string): Promise<Contact[]>;
  getByPhone(phone: string): Promise<Contact | null>;
  create(contact: Omit<Contact, 'id' | 'updatedAt'>): Promise<Contact>;
  createMany(contacts: Array<Omit<Contact, 'id' | 'updatedAt'>>): Promise<Contact[]>;
  addPersonalNumber(data: { phone: string; memberId: string; teamId: string; city?: string; secondaryMobile?: string; code?: string }): Promise<Contact>;
  checkDuplicate(data: { phone: string; memberId?: string; teamId?: string }): Promise<DuplicatePhoneCheckResult>;
  update(id: string, updates: Partial<Contact>): Promise<Contact>;
  updateManyStatus(ids: string[], status: ContactStatus): Promise<void>;
}

export interface IAllocationRepository {
  getAll(): Promise<ContactAllocation[]>;
  getByBatchId(batchId: string): Promise<ContactAllocation[]>;
  getByMemberId(memberId: string): Promise<ContactAllocation[]>;
  createMany(allocations: Array<Omit<ContactAllocation, 'id'>>): Promise<ContactAllocation[]>;
}

export interface ICallLogRepository {
  getAll(): Promise<CallLog[]>;
  getByContactId(contactId: string): Promise<CallLog[]>;
  getByMemberId(memberId: string): Promise<CallLog[]>;
  getByTeamId(teamId: string): Promise<CallLog[]>;
  create(log: Omit<CallLog, 'id'>): Promise<CallLog>;
  update(id: string, updates: Partial<CallLog>): Promise<CallLog>;
}

export interface ICustomerRepository {
  getAll(): Promise<Customer[]>;
  getById(id: string): Promise<Customer | null>;
  getByContactId(contactId: string): Promise<Customer | null>;
  getByTeamId(teamId: string): Promise<Customer[]>;
  getBySupervisorId(supervisorId: string): Promise<Customer[]>;
  getByMemberId(memberId: string): Promise<Customer[]>;
  create(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer>;
  update(id: string, updates: Partial<Customer>): Promise<Customer>;
}

export interface IOrderRepository {
  getAll(): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  getByCustomerId(customerId: string): Promise<Order[]>;
  getByTeamId(teamId: string): Promise<Order[]>;
  getBySupervisorId(supervisorId: string): Promise<Order[]>;
  getByMemberId(memberId: string): Promise<Order[]>;
  create(order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & { orderNumber?: string }): Promise<Order>;
  updateStatus(id: string, status: any, remarks?: string): Promise<Order>;
}

export interface IDeliveryStatusHistoryRepository {
  getAll(): Promise<DeliveryStatusHistory[]>;
  getByOrderId(orderId: string): Promise<DeliveryStatusHistory[]>;
  create(history: Omit<DeliveryStatusHistory, 'id' | 'createdAt'>): Promise<DeliveryStatusHistory>;
}

export interface IActivityLogRepository {
  getAll(): Promise<ActivityLog[]>;
  getByUserId(userId: string): Promise<ActivityLog[]>;
  getRecentWithinMonth(userId?: string): Promise<ActivityLog[]>;
  getByEntity(entityType: string, entityId: string): Promise<ActivityLog[]>;
  create(log: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog>;
}

export interface IExpenseRepository {
  getAll(): Promise<Expense[]>;
  getCategories(): Promise<ExpenseCategory[]>;
  create(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense>;
  createCategory(category: Omit<ExpenseCategory, 'id'>): Promise<ExpenseCategory>;
}

export interface IEmailNotificationRepository {
  getAll(): Promise<EmailNotification[]>;
  getByCustomerId(customerId: string): Promise<EmailNotification[]>;
  getByOrderId(orderId: string): Promise<EmailNotification[]>;
  create(data: Omit<EmailNotification, 'id' | 'sentAt'>): Promise<EmailNotification>;
}

export interface IProductRepository {
  getAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getByTeamId(teamId: string): Promise<Product[]>;
  create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>;
  update(id: string, updates: Partial<Product>): Promise<Product>;
  updateStock(id: string, stockDelta: number): Promise<Product>;
  reportDamage(id: string, quantity: number, reason?: string, batchId?: string): Promise<Product>;
  delete(id: string): Promise<void>;
}

export interface IStockActivityLogRepository {
  getAll(): Promise<StockActivityLog[]>;
  getByProductId(productId: string): Promise<StockActivityLog[]>;
  getByTeamId(teamId: string): Promise<StockActivityLog[]>;
  create(log: Omit<StockActivityLog, 'id' | 'createdAt'>): Promise<StockActivityLog>;
}

export interface IApprovalRequestRepository {
  getAll(): Promise<ApprovalRequest[]>;
  getById(id: string): Promise<ApprovalRequest | null>;
  getByStatus(status: ApprovalStatus): Promise<ApprovalRequest[]>;
  getByTeamId(teamId: string): Promise<ApprovalRequest[]>;
  create(request: Omit<ApprovalRequest, 'id' | 'createdAt' | 'status'>): Promise<ApprovalRequest>;
  review(id: string, status: 'APPROVED' | 'REJECTED', reviewedBy: User, rejectionReason?: string): Promise<ApprovalRequest>;
}

export interface IPettyCashRepository {
  getWallet(teamId?: string): Promise<PettyCashWallet>;
  getTransactions(): Promise<PettyCashTransaction[]>;
  allocate(amount: number, user: User, reason?: string): Promise<PettyCashWallet>;
  recordExpense(data: { amount: number; reason: string; category: string; description: string; date: string }, user: User): Promise<PettyCashTransaction>;
}

export interface ISalesTargetRepository {
  getAll(month?: string, teamId?: string): Promise<TeamSalesTarget[]>;
  getById(id: string): Promise<TeamSalesTarget | null>;
  upsert(target: {
    teamId: string;
    month: string;
    targetAmount: number;
    notes?: string;
    tiers: TeamTargetTier[];
  }): Promise<TeamSalesTarget>;
  update(id: string, updates: Partial<TeamSalesTarget>): Promise<TeamSalesTarget>;
  delete(id: string): Promise<void>;
}

