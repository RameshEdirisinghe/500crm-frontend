import apiClient from '../../lib/apiClient';
import {
  ITeamRepository,
  IUserRepository,
  IContactRepository,
  IAllocationRepository,
  ICallLogRepository,
  ICustomerRepository,
  IOrderRepository,
  IDeliveryStatusHistoryRepository,
  IActivityLogRepository,
  IExpenseRepository,
  IEmailNotificationRepository,
  IProductRepository,
  IStockActivityLogRepository,
  IApprovalRequestRepository,
  IPettyCashRepository,
  ISalesTargetRepository,
} from '../interfaces';
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

// ─── Helper ──────────────────────────────────────────────────────────────────
// All backend responses are wrapped as { success: true, data: T }
const unwrap = <T>(response: { data: { data: T } }): T => response.data.data;

// ─────────────────────────────────────────────────────────────────────────────
// Team
// ─────────────────────────────────────────────────────────────────────────────
export class ApiTeamRepository implements ITeamRepository {
  async getAll(): Promise<Team[]> {
    return unwrap(await apiClient.get<{ data: Team[] }>('/teams'));
  }
  async getById(id: string): Promise<Team | null> {
    try {
      return unwrap(await apiClient.get<{ data: Team }>(`/teams/${id}`));
    } catch {
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────────────────────
export class ApiUserRepository implements IUserRepository {
  async getAll(): Promise<User[]> {
    const res = unwrap(await apiClient.get<{ data: any }>('/users')) as any;
    // getAll returns paginated: { items, total } — extract items
    return Array.isArray(res) ? res : res.items ?? res;
  }
  async getById(id: string): Promise<User | null> {
    try {
      return unwrap(await apiClient.get<{ data: User }>(`/users/${id}`));
    } catch {
      return null;
    }
  }
  async getByEmail(email: string): Promise<User | null> {
    try {
      const all = await this.getAll();
      return all.find((u) => u.email === email || u.username === email) ?? null;
    } catch {
      return null;
    }
  }
  async getByRole(role: UserRole): Promise<User[]> {
    const all = await this.getAll();
    return all.filter((u) => u.role === role);
  }
  async getByTeamId(teamId: string): Promise<User[]> {
    return unwrap(
      await apiClient.get<{ data: User[] }>(`/users/leaderboard?teamId=${teamId}`)
    );
  }
  async getBySupervisorId(supervisorId: string): Promise<User[]> {
    const all = await this.getAll();
    return all.filter((u) => u.supervisorId === supervisorId);
  }
  async create(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const payload: Record<string, any> = {
      username: userData.username || userData.email.split('@')[0],
      email: userData.email.trim().toLowerCase(),
      password: userData.password || 'ChangeThisStrongPassword123!',
      fullName: userData.fullName,
      role: userData.role,
      phone: userData.phone,
      joiningDate: userData.joiningDate ? userData.joiningDate.split('T')[0] : new Date().toISOString().split('T')[0],
    };

    if (userData.teamId && userData.teamId.trim() !== '') {
      payload.teamId = userData.teamId;
    }
    if (userData.supervisorId && userData.supervisorId.trim() !== '') {
      payload.supervisorId = userData.supervisorId;
    }
    if (userData.avatarUrl && userData.avatarUrl.trim() !== '') {
      payload.avatarUrl = userData.avatarUrl;
    }
    if (userData.nic && userData.nic.trim() !== '') {
      payload.nic = userData.nic;
    }
    if (userData.dateOfBirth && userData.dateOfBirth.trim() !== '') {
      payload.dateOfBirth = userData.dateOfBirth.split('T')[0];
    }
    if (typeof userData.salary === 'number') {
      payload.salary = userData.salary;
    }
    if (typeof userData.monthlyGoal === 'number') {
      payload.monthlyGoal = userData.monthlyGoal;
    }

    return unwrap(await apiClient.post<{ data: User }>('/users', payload));
  }
  async update(id: string, updates: Partial<User>): Promise<User> {
    const payload: Record<string, any> = {};
    if (updates.fullName !== undefined) payload.fullName = updates.fullName;
    if (updates.username !== undefined) payload.username = updates.username;
    if (updates.email !== undefined) payload.email = updates.email.trim().toLowerCase();
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.avatarUrl !== undefined) payload.avatarUrl = updates.avatarUrl;
    if (updates.nic !== undefined) payload.nic = updates.nic;
    if (updates.dateOfBirth !== undefined) payload.dateOfBirth = updates.dateOfBirth ? updates.dateOfBirth.split('T')[0] : undefined;
    if (updates.joiningDate !== undefined) payload.joiningDate = updates.joiningDate ? updates.joiningDate.split('T')[0] : undefined;
    if (updates.teamId !== undefined) payload.teamId = updates.teamId || undefined;
    if (updates.supervisorId !== undefined) payload.supervisorId = updates.supervisorId || undefined;
    if (updates.salary !== undefined) payload.salary = updates.salary;
    if (updates.monthlyGoal !== undefined) payload.monthlyGoal = updates.monthlyGoal;
    if (updates.password !== undefined && updates.password.trim() !== '') payload.password = updates.password;

    return unwrap(await apiClient.patch<{ data: User }>(`/users/${id}`, payload));
  }
  async updateMe(updates: Partial<User>): Promise<User> {
    const payload: Record<string, any> = {};
    if (updates.fullName !== undefined) payload.fullName = updates.fullName;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.avatarUrl !== undefined) payload.avatarUrl = updates.avatarUrl;
    if (updates.dateOfBirth !== undefined) payload.dateOfBirth = updates.dateOfBirth ? updates.dateOfBirth.split('T')[0] : undefined;
    if (updates.password !== undefined && updates.password.trim() !== '') payload.password = updates.password;

    return unwrap(await apiClient.patch<{ data: User }>('/users/me', payload));
  }
  async disable(id: string): Promise<void> {
    await apiClient.patch(`/users/${id}/status`, { isActive: false });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact
// ─────────────────────────────────────────────────────────────────────────────
export class ApiContactRepository implements IContactRepository {
  async getAll(): Promise<Contact[]> {
    return unwrap(await apiClient.get<{ data: Contact[] }>('/contacts'));
  }
  async getById(id: string): Promise<Contact | null> {
    try {
      return unwrap(await apiClient.get<{ data: Contact }>(`/contacts/${id}`));
    } catch {
      return null;
    }
  }
  async getByTeamId(teamId: string): Promise<Contact[]> {
    return unwrap(await apiClient.get<{ data: Contact[] }>(`/contacts?teamId=${teamId}`));
  }
  async getByMemberId(memberId: string): Promise<Contact[]> {
    return unwrap(await apiClient.get<{ data: Contact[] }>(`/contacts?memberId=${memberId}`));
  }
  async getByPhone(phone: string): Promise<Contact | null> {
    try {
      return unwrap(
        await apiClient.get<{ data: Contact }>(`/contacts/lookup/phone?phone=${encodeURIComponent(phone)}&teamId=`)
      );
    } catch {
      return null;
    }
  }
  async create(contact: Omit<Contact, 'id' | 'updatedAt'>): Promise<Contact> {
    const payload = {
      phone: contact.phone,
      status: contact.status,
      teamId: contact.teamId,
      importedById: (contact as any).importedById || contact.importedBy,
      addedById: (contact as any).addedById || contact.addedBy,
      importBatchId: contact.importBatchId,
      isAllocated: contact.isAllocated,
      allocatedToId: contact.allocatedToId,
      allocatedAt: contact.allocatedAt,
      allocationBatchId: contact.allocationBatchId,
      allocationSource: contact.allocationSource,
      isSelfAdded: contact.isSelfAdded,
      city: contact.city,
      code: contact.code,
      secondaryMobile: contact.secondaryMobile,
      attemptCount: contact.attemptCount,
      lastCalledAt: contact.lastCalledAt,
      isFollowUp: contact.isFollowUp,
    };
    return unwrap(await apiClient.post<{ data: Contact }>('/contacts', payload));
  }
  async createMany(contacts: Array<Omit<Contact, 'id' | 'updatedAt'>>): Promise<Contact[]> {
    const cleaned = contacts.map((c) => ({
      code: c.code,
      phone: c.phone,
      status: c.status,
      teamId: c.teamId,
      importedById: (c as any).importedById || c.importedBy,
      addedById: (c as any).addedById || c.addedBy,
      importBatchId: c.importBatchId,
      isAllocated: c.isAllocated,
      allocatedToId: c.allocatedToId,
      allocatedAt: c.allocatedAt,
      allocationBatchId: c.allocationBatchId,
      allocationSource: c.allocationSource,
      isSelfAdded: c.isSelfAdded,
      city: c.city,
      secondaryMobile: c.secondaryMobile,
      attemptCount: c.attemptCount,
      lastCalledAt: c.lastCalledAt,
      isFollowUp: c.isFollowUp,
    }));
    return unwrap(await apiClient.post<{ data: Contact[] }>('/contacts/bulk', { contacts: cleaned }));
  }
  async addPersonalNumber(data: {
    phone: string;
    memberId: string;
    teamId: string;
    city?: string;
    secondaryMobile?: string;
    code?: string;
  }): Promise<Contact> {
    return unwrap(await apiClient.post<{ data: Contact }>('/contacts/personal', data));
  }
  async checkDuplicate(data: { phone: string; memberId?: string; teamId?: string }): Promise<DuplicatePhoneCheckResult> {
    return unwrap(await apiClient.post<{ data: DuplicatePhoneCheckResult }>('/contacts/check-duplicate', data));
  }
  async update(id: string, updates: Partial<Contact>): Promise<Contact> {
    return unwrap(await apiClient.patch<{ data: Contact }>(`/contacts/${id}`, updates));
  }
  async updateManyStatus(ids: string[], status: ContactStatus): Promise<void> {
    await apiClient.patch('/contacts/bulk/status', { ids, status });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Allocation
// ─────────────────────────────────────────────────────────────────────────────
export class ApiAllocationRepository implements IAllocationRepository {
  async getAll(): Promise<ContactAllocation[]> {
    return unwrap(await apiClient.get<{ data: ContactAllocation[] }>('/allocations'));
  }
  async getByBatchId(batchId: string): Promise<ContactAllocation[]> {
    return unwrap(
      await apiClient.get<{ data: ContactAllocation[] }>(`/allocations/batch/${batchId}`)
    );
  }
  async getByMemberId(memberId: string): Promise<ContactAllocation[]> {
    return unwrap(
      await apiClient.get<{ data: ContactAllocation[] }>(`/allocations?memberId=${memberId}`)
    );
  }
  async createMany(
    allocations: Array<Omit<ContactAllocation, 'id'>>
  ): Promise<ContactAllocation[]> {
    return unwrap(
      await apiClient.post<{ data: ContactAllocation[] }>('/allocations/bulk', { allocations })
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CallLog
// ─────────────────────────────────────────────────────────────────────────────
export class ApiCallLogRepository implements ICallLogRepository {
  async getAll(): Promise<CallLog[]> {
    return unwrap(await apiClient.get<{ data: CallLog[] }>('/call-logs'));
  }
  async getByContactId(contactId: string): Promise<CallLog[]> {
    return unwrap(
      await apiClient.get<{ data: CallLog[] }>(`/call-logs?contactId=${contactId}`)
    );
  }
  async getByMemberId(memberId: string): Promise<CallLog[]> {
    return unwrap(
      await apiClient.get<{ data: CallLog[] }>(`/call-logs?memberId=${memberId}`)
    );
  }
  async getByTeamId(teamId: string): Promise<CallLog[]> {
    return unwrap(
      await apiClient.get<{ data: CallLog[] }>(`/call-logs?teamId=${teamId}`)
    );
  }
  async create(log: Omit<CallLog, 'id'>): Promise<CallLog> {
    return unwrap(await apiClient.post<{ data: CallLog }>('/call-logs', log));
  }
  async update(id: string, updates: Partial<CallLog>): Promise<CallLog> {
    return unwrap(await apiClient.patch<{ data: CallLog }>(`/call-logs/${id}`, updates));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer
// ─────────────────────────────────────────────────────────────────────────────
export class ApiCustomerRepository implements ICustomerRepository {
  async getAll(): Promise<Customer[]> {
    return unwrap(await apiClient.get<{ data: Customer[] }>('/customers'));
  }
  async getById(id: string): Promise<Customer | null> {
    try {
      return unwrap(await apiClient.get<{ data: Customer }>(`/customers/${id}`));
    } catch {
      return null;
    }
  }
  async getByContactId(contactId: string): Promise<Customer | null> {
    try {
      return unwrap(
        await apiClient.get<{ data: Customer }>(`/customers/contact/${contactId}`)
      );
    } catch {
      return null;
    }
  }
  async getByTeamId(teamId: string): Promise<Customer[]> {
    return unwrap(await apiClient.get<{ data: Customer[] }>(`/customers?teamId=${teamId}`));
  }
  async getBySupervisorId(supervisorId: string): Promise<Customer[]> {
    return unwrap(
      await apiClient.get<{ data: Customer[] }>(`/customers?supervisorId=${supervisorId}`)
    );
  }
  async getByMemberId(memberId: string): Promise<Customer[]> {
    return unwrap(
      await apiClient.get<{ data: Customer[] }>(`/customers?memberId=${memberId}`)
    );
  }
  async create(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    return unwrap(await apiClient.post<{ data: Customer }>('/customers', customer));
  }
  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    return unwrap(await apiClient.patch<{ data: Customer }>(`/customers/${id}`, updates));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order
// ─────────────────────────────────────────────────────────────────────────────
export class ApiOrderRepository implements IOrderRepository {
  async getAll(): Promise<Order[]> {
    return unwrap(await apiClient.get<{ data: Order[] }>('/orders'));
  }
  async getById(id: string): Promise<Order | null> {
    try {
      return unwrap(await apiClient.get<{ data: Order }>(`/orders/${id}`));
    } catch {
      return null;
    }
  }
  async getByCustomerId(customerId: string): Promise<Order[]> {
    return unwrap(
      await apiClient.get<{ data: Order[] }>(`/orders?customerId=${customerId}`)
    );
  }
  async getByTeamId(teamId: string): Promise<Order[]> {
    return unwrap(await apiClient.get<{ data: Order[] }>(`/orders?teamId=${teamId}`));
  }
  async getBySupervisorId(supervisorId: string): Promise<Order[]> {
    return unwrap(
      await apiClient.get<{ data: Order[] }>(`/orders?supervisorId=${supervisorId}`)
    );
  }
  async getByMemberId(memberId: string): Promise<Order[]> {
    return unwrap(await apiClient.get<{ data: Order[] }>(`/orders?memberId=${memberId}`));
  }
  async create(order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & { orderNumber?: string }): Promise<Order> {
    return unwrap(await apiClient.post<{ data: Order }>('/orders', order));
  }
  async updateStatus(id: string, status: any, remarks?: string): Promise<Order> {
    return unwrap(
      await apiClient.patch<{ data: Order }>(`/orders/${id}/status`, { status, remarks })
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DeliveryStatusHistory
// ─────────────────────────────────────────────────────────────────────────────
export class ApiDeliveryStatusHistoryRepository implements IDeliveryStatusHistoryRepository {
  async getAll(): Promise<DeliveryStatusHistory[]> {
    return [];
  }
  async getByOrderId(orderId: string): Promise<DeliveryStatusHistory[]> {
    return unwrap(
      await apiClient.get<{ data: DeliveryStatusHistory[] }>(
        `/delivery-status-history/order/${orderId}`
      )
    );
  }
  async create(
    history: Omit<DeliveryStatusHistory, 'id' | 'createdAt'>
  ): Promise<DeliveryStatusHistory> {
    return {
      id: `hist_${Date.now()}`,
      orderId: history.orderId,
      previousStatus: history.previousStatus,
      newStatus: history.newStatus,
      remarks: history.remarks,
      actorUserId: history.actorUserId,
      createdAt: new Date().toISOString(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityLog
// ─────────────────────────────────────────────────────────────────────────────
export class ApiActivityLogRepository implements IActivityLogRepository {
  async getAll(): Promise<ActivityLog[]> {
    return unwrap(await apiClient.get<{ data: ActivityLog[] }>('/activity-logs'));
  }
  async getByUserId(userId: string): Promise<ActivityLog[]> {
    return unwrap(
      await apiClient.get<{ data: ActivityLog[] }>(`/activity-logs?userId=${userId}`)
    );
  }
  async getRecentWithinMonth(userId?: string): Promise<ActivityLog[]> {
    const url = userId
      ? `/activity-logs?recent=true&userId=${userId}`
      : '/activity-logs?recent=true';
    return unwrap(await apiClient.get<{ data: ActivityLog[] }>(url));
  }
  async getByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    const all = await this.getAll();
    return all.filter((l) => l.entityType === entityType && l.entityId === entityId);
  }
  async create(log: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog> {
    return unwrap(await apiClient.post<{ data: ActivityLog }>('/activity-logs', log));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Expense
// ─────────────────────────────────────────────────────────────────────────────
export class ApiExpenseRepository implements IExpenseRepository {
  async getAll(): Promise<Expense[]> {
    return unwrap(await apiClient.get<{ data: Expense[] }>('/expenses'));
  }
  async getCategories(): Promise<ExpenseCategory[]> {
    return unwrap(await apiClient.get<{ data: ExpenseCategory[] }>('/expenses/categories'));
  }
  async create(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
    return unwrap(await apiClient.post<{ data: Expense }>('/expenses', expense));
  }
  async createCategory(
    category: Omit<ExpenseCategory, 'id'>
  ): Promise<ExpenseCategory> {
    return unwrap(
      await apiClient.post<{ data: ExpenseCategory }>('/expenses/categories', category)
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EmailNotification
// ─────────────────────────────────────────────────────────────────────────────
export class ApiEmailNotificationRepository implements IEmailNotificationRepository {
  async getAll(): Promise<EmailNotification[]> {
    return unwrap(await apiClient.get<{ data: EmailNotification[] }>('/email-notifications'));
  }
  async getByCustomerId(customerId: string): Promise<EmailNotification[]> {
    return unwrap(
      await apiClient.get<{ data: EmailNotification[] }>(
        `/email-notifications?customerId=${customerId}`
      )
    );
  }
  async getByOrderId(orderId: string): Promise<EmailNotification[]> {
    return unwrap(
      await apiClient.get<{ data: EmailNotification[] }>(
        `/email-notifications?orderId=${orderId}`
      )
    );
  }
  async create(
    data: Omit<EmailNotification, 'id' | 'sentAt'>
  ): Promise<EmailNotification> {
    return unwrap(
      await apiClient.post<{ data: EmailNotification }>('/email-notifications', data)
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product
// ─────────────────────────────────────────────────────────────────────────────
export class ApiProductRepository implements IProductRepository {
  async getAll(): Promise<Product[]> {
    return unwrap(await apiClient.get<{ data: Product[] }>('/products'));
  }
  async getById(id: string): Promise<Product | null> {
    try {
      return unwrap(await apiClient.get<{ data: Product }>(`/products/${id}`));
    } catch {
      return null;
    }
  }
  async getByTeamId(teamId: string): Promise<Product[]> {
    return unwrap(await apiClient.get<{ data: Product[] }>(`/products?teamId=${teamId}`));
  }
  async create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    return unwrap(await apiClient.post<{ data: Product }>('/products', product));
  }
  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const payload: any = { ...updates };
    delete payload.id;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.team;
    delete payload.batches;
    delete payload.priceHistory;
    return unwrap(await apiClient.patch<{ data: Product }>(`/products/${id}`, payload));
  }
  async updateStock(id: string, stockDelta: number): Promise<Product> {
    return unwrap(
      await apiClient.patch<{ data: Product }>(`/products/${id}/stock`, { stockDelta })
    );
  }
  async reportDamage(id: string, quantity: number, reason?: string, batchId?: string): Promise<Product> {
    return unwrap(
      await apiClient.post<{ data: Product }>(`/products/${id}/damage`, { quantity, reason, batchId })
    );
  }
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/products/${id}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// StockActivityLog
// ─────────────────────────────────────────────────────────────────────────────
export class ApiStockActivityLogRepository implements IStockActivityLogRepository {
  async getAll(): Promise<StockActivityLog[]> {
    return unwrap(await apiClient.get<{ data: StockActivityLog[] }>('/products/stock-logs'));
  }
  async getByProductId(productId: string): Promise<StockActivityLog[]> {
    return unwrap(
      await apiClient.get<{ data: StockActivityLog[] }>(
        `/products/stock-logs?productId=${productId}`
      )
    );
  }
  async getByTeamId(teamId: string): Promise<StockActivityLog[]> {
    return unwrap(
      await apiClient.get<{ data: StockActivityLog[] }>(
        `/products/stock-logs?teamId=${teamId}`
      )
    );
  }
  async create(log: Omit<StockActivityLog, 'id' | 'createdAt'>): Promise<StockActivityLog> {
    throw new Error('Stock logs are created internally by backend operations');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ApprovalRequest
// ─────────────────────────────────────────────────────────────────────────────
export class ApiApprovalRequestRepository implements IApprovalRequestRepository {
  async getAll(): Promise<ApprovalRequest[]> {
    return unwrap(await apiClient.get<{ data: ApprovalRequest[] }>('/approval-requests'));
  }
  async getById(id: string): Promise<ApprovalRequest | null> {
    try {
      return unwrap(await apiClient.get<{ data: ApprovalRequest }>(`/approval-requests/${id}`));
    } catch {
      return null;
    }
  }
  async getByStatus(status: ApprovalStatus): Promise<ApprovalRequest[]> {
    return unwrap(
      await apiClient.get<{ data: ApprovalRequest[] }>(`/approval-requests?status=${status}`)
    );
  }
  async getByTeamId(teamId: string): Promise<ApprovalRequest[]> {
    return unwrap(
      await apiClient.get<{ data: ApprovalRequest[] }>(`/approval-requests?teamId=${teamId}`)
    );
  }
  async create(
    request: Omit<ApprovalRequest, 'id' | 'createdAt' | 'status'>
  ): Promise<ApprovalRequest> {
    return unwrap(
      await apiClient.post<{ data: ApprovalRequest }>('/approval-requests', request)
    );
  }
  async review(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewedBy: User,
    rejectionReason?: string
  ): Promise<ApprovalRequest> {
    return unwrap(
      await apiClient.patch<{ data: ApprovalRequest }>(`/approval-requests/${id}/review`, {
        status,
        reviewedById: reviewedBy.id,
        reviewedByName: reviewedBy.fullName,
        rejectionReason,
      })
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PettyCash
// ─────────────────────────────────────────────────────────────────────────────
export class ApiPettyCashRepository implements IPettyCashRepository {
  async getWallet(teamId?: string): Promise<PettyCashWallet> {
    const url = teamId ? `/petty-cash/wallet?teamId=${teamId}` : '/petty-cash/wallet';
    return unwrap(await apiClient.get<{ data: PettyCashWallet }>(url));
  }
  async getTransactions(): Promise<PettyCashTransaction[]> {
    return unwrap(
      await apiClient.get<{ data: PettyCashTransaction[] }>('/petty-cash/transactions')
    );
  }
  async allocate(amount: number, user: User, reason?: string): Promise<PettyCashWallet> {
    return unwrap(
      await apiClient.post<{ data: PettyCashWallet }>('/petty-cash/allocate', {
        amount,
        userId: user.id,
        userName: user.fullName,
        reason,
        teamId: user.teamId,
      })
    );
  }
  async recordExpense(
    data: { amount: number; reason: string; category: string; description: string; date: string },
    user: User
  ): Promise<PettyCashTransaction> {
    return unwrap(
      await apiClient.post<{ data: PettyCashTransaction }>('/petty-cash/expense', {
        ...data,
        userId: user.id,
        userName: user.fullName,
        teamId: user.teamId,
      })
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Targets & Incentives
// ─────────────────────────────────────────────────────────────────────────────
export class ApiSalesTargetRepository implements ISalesTargetRepository {
  async getAll(month?: string, teamId?: string): Promise<TeamSalesTarget[]> {
    const params: Record<string, string> = {};
    if (month) params.month = month;
    if (teamId) params.teamId = teamId;
    return unwrap(
      await apiClient.get<{ data: TeamSalesTarget[] }>('/sales-targets', { params })
    );
  }

  async getById(id: string): Promise<TeamSalesTarget | null> {
    try {
      return unwrap(
        await apiClient.get<{ data: TeamSalesTarget }>(`/sales-targets/${id}`)
      );
    } catch {
      return null;
    }
  }

  async upsert(target: {
    teamId: string;
    month: string;
    targetAmount: number;
    notes?: string;
    tiers: TeamTargetTier[];
  }): Promise<TeamSalesTarget> {
    return unwrap(
      await apiClient.post<{ data: TeamSalesTarget }>('/sales-targets', target)
    );
  }

  async update(id: string, updates: Partial<TeamSalesTarget>): Promise<TeamSalesTarget> {
    return unwrap(
      await apiClient.patch<{ data: TeamSalesTarget }>(`/sales-targets/${id}`, updates)
    );
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/sales-targets/${id}`);
  }
}
