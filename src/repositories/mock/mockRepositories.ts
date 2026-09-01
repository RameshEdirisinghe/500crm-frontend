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
  OrderStatus,
  Product,
  StockActivityLog,
  ApprovalRequest,
  ApprovalStatus,
  PettyCashWallet,
  PettyCashTransaction,
  TeamSalesTarget,
  TeamTargetTier,
  DuplicatePhoneCheckResult,
} from '../../models/domain';
import { STORAGE_KEYS, getStoredItem, setStoredItem, delay } from './mockStore';

export class MockTeamRepository implements ITeamRepository {
  async getAll(): Promise<Team[]> {
    await delay();
    return getStoredItem<Team>(STORAGE_KEYS.TEAMS, []);
  }

  async getById(id: string): Promise<Team | null> {
    await delay();
    const teams = getStoredItem<Team>(STORAGE_KEYS.TEAMS, []);
    return teams.find((t) => t.id === id) || null;
  }
}

export class MockUserRepository implements IUserRepository {
  async getAll(): Promise<User[]> {
    await delay();
    return getStoredItem<User>(STORAGE_KEYS.USERS, []);
  }

  async getById(id: string): Promise<User | null> {
    await delay();
    const users = getStoredItem<User>(STORAGE_KEYS.USERS, []);
    return users.find((u) => u.id === id) || null;
  }

  async getByEmail(email: string): Promise<User | null> {
    await delay();
    const users = getStoredItem<User>(STORAGE_KEYS.USERS, []);
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === email.toLowerCase()) || null;
  }

  async getByRole(role: UserRole): Promise<User[]> {
    await delay();
    const users = getStoredItem<User>(STORAGE_KEYS.USERS, []);
    return users.filter((u) => u.role === role);
  }

  async getByTeamId(teamId: string): Promise<User[]> {
    await delay();
    const users = getStoredItem<User>(STORAGE_KEYS.USERS, []);
    return users.filter((u) => u.teamId === teamId);
  }

  async getBySupervisorId(supervisorId: string): Promise<User[]> {
    await delay();
    const users = getStoredItem<User>(STORAGE_KEYS.USERS, []);
    return users.filter((u) => u.supervisorId === supervisorId);
  }

  async create(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    await delay();
    const users = getStoredItem<User>(STORAGE_KEYS.USERS, []);
    const newUser: User = {
      ...userData,
      id: `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    setStoredItem(STORAGE_KEYS.USERS, users);
    return newUser;
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    await delay();
    const users = getStoredItem<User>(STORAGE_KEYS.USERS, []);
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) throw new Error('User not found');
    const updated = { ...users[index], ...updates };
    users[index] = updated;
    setStoredItem(STORAGE_KEYS.USERS, users);

    const rawCurr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (rawCurr) {
      try {
        const parsed = JSON.parse(rawCurr);
        if (parsed && parsed.id === id) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updated));
        }
      } catch (e) {}
    }

    return updated;
  }

  async updateMe(updates: Partial<User>): Promise<User> {
    const rawCurr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!rawCurr) throw new Error('No authenticated user found');
    const parsed = JSON.parse(rawCurr);
    return this.update(parsed.id, updates);
  }

  async disable(id: string): Promise<void> {
    await delay();
    const users = getStoredItem<User>(STORAGE_KEYS.USERS, []);
    const index = users.findIndex((u) => u.id === id);
    if (index !== -1) {
      users[index].isActive = false;
      setStoredItem(STORAGE_KEYS.USERS, users);
    }
  }
}

export class MockContactRepository implements IContactRepository {
  async getAll(): Promise<Contact[]> {
    await delay();
    return getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
  }

  async getById(id: string): Promise<Contact | null> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    return contacts.find((c) => c.id === id) || null;
  }

  async getByTeamId(teamId: string): Promise<Contact[]> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    return contacts.filter((c) => c.teamId === teamId);
  }

  async getByMemberId(memberId: string): Promise<Contact[]> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    return contacts.filter((c) => c.allocatedToId === memberId);
  }

  async getByPhone(phone: string): Promise<Contact | null> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    return contacts.find((c) => c.phone.trim() === phone.trim()) || null;
  }

  async create(contactData: Omit<Contact, 'id' | 'updatedAt'>): Promise<Contact> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    const now = new Date().toISOString();
    const newContact: Contact = {
      ...contactData,
      id: `cnt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      updatedAt: now,
    };
    contacts.push(newContact);
    setStoredItem(STORAGE_KEYS.CONTACTS, contacts);
    return newContact;
  }

  async createMany(contactsData: Array<Omit<Contact, 'id' | 'updatedAt'>>): Promise<Contact[]> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    const now = new Date().toISOString();
    const created: Contact[] = contactsData.map((cd, index) => ({
      ...cd,
      id: `cnt_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
      updatedAt: now,
    }));
    contacts.push(...created);
    setStoredItem(STORAGE_KEYS.CONTACTS, contacts);
    return created;
  }

  async update(id: string, updates: Partial<Contact>): Promise<Contact> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    const index = contacts.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Contact not found');
    const updated = { ...contacts[index], ...updates, updatedAt: new Date().toISOString() };
    contacts[index] = updated;
    setStoredItem(STORAGE_KEYS.CONTACTS, contacts);
    return updated;
  }

  async updateManyStatus(ids: string[], status: ContactStatus): Promise<void> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    const now = new Date().toISOString();
    let changed = false;
    contacts.forEach((c) => {
      if (ids.includes(c.id)) {
        c.status = status;
        c.updatedAt = now;
        changed = true;
      }
    });
    if (changed) setStoredItem(STORAGE_KEYS.CONTACTS, contacts);
  }

  async addPersonalNumber(data: { phone: string; memberId: string; teamId: string; city?: string; secondaryMobile?: string; code?: string }): Promise<Contact> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    const now = new Date().toISOString();
    const targetContact: Contact = {
      id: `cnt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      code: data.code,
      phone: data.phone.trim(),
      status: 'NEW',
      teamId: data.teamId,
      importedAt: now,
      importedBy: data.memberId,
      addedBy: data.memberId,
      importBatchId: `bat_self_${Date.now()}`,
      isAllocated: true,
      allocatedToId: data.memberId,
      allocatedAt: now,
      allocationBatchId: `alc_self_${Date.now()}`,
      autoAllocatedTo: data.memberId,
      allocationSource: 'SELF_ADDED',
      isSelfAdded: true,
      city: data.city,
      secondaryMobile: data.secondaryMobile,
      attemptCount: 0,
      lastCalledAt: null,
      isFollowUp: false,
      updatedAt: now,
    };
    contacts.push(targetContact);
    setStoredItem(STORAGE_KEYS.CONTACTS, contacts);

    // Record allocation history entry
    const allocations = getStoredItem<ContactAllocation>(STORAGE_KEYS.ALLOCATIONS, []);
    const newAllocation: ContactAllocation = {
      id: `alc_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      allocationBatchId: `alc_self_${Date.now()}`,
      contactId: targetContact.id,
      teamMemberId: data.memberId,
      supervisorId: data.memberId,
      teamId: data.teamId,
      allocatedAt: now,
      isSelfAdded: true,
      allocationSource: 'SELF_ADDED',
    };
    allocations.push(newAllocation);
    setStoredItem(STORAGE_KEYS.ALLOCATIONS, allocations);

    return targetContact;
  }

  async checkDuplicate(data: { phone: string; memberId?: string; teamId?: string }): Promise<DuplicatePhoneCheckResult> {
    await delay();
    const contacts = getStoredItem<Contact>(STORAGE_KEYS.CONTACTS, []);
    const clean = data.phone.trim();
    const own = contacts.find((c) => c.phone === clean && c.allocatedToId === data.memberId);
    if (own) {
      return { exists: true, isOwnedBySelf: true, message: 'This phone number already exists in your profile queue.' };
    }
    const other = contacts.find((c) => c.phone === clean);
    if (!other) {
      return { exists: false, isOwnedBySelf: false };
    }
    return {
      exists: true,
      isOwnedBySelf: false,
      message: 'This number already exists in the CRM and was assigned or called previously.',
      intelligence: {
        phone: clean,
        assignedMemberName: 'Other Sales Specialist',
        teamName: 'CRM Team',
        lastCallStatus: other.status,
        lastCalledAt: other.lastCalledAt,
        previousOrders: [],
      },
    };
  }
}

export class MockAllocationRepository implements IAllocationRepository {
  async getAll(): Promise<ContactAllocation[]> {
    await delay();
    return getStoredItem<ContactAllocation>(STORAGE_KEYS.ALLOCATIONS, []);
  }

  async getByBatchId(batchId: string): Promise<ContactAllocation[]> {
    await delay();
    const allocations = getStoredItem<ContactAllocation>(STORAGE_KEYS.ALLOCATIONS, []);
    return allocations.filter((a) => a.allocationBatchId === batchId);
  }

  async getByMemberId(memberId: string): Promise<ContactAllocation[]> {
    await delay();
    const allocations = getStoredItem<ContactAllocation>(STORAGE_KEYS.ALLOCATIONS, []);
    return allocations.filter((a) => a.teamMemberId === memberId);
  }

  async createMany(allocationsData: Array<Omit<ContactAllocation, 'id'>>): Promise<ContactAllocation[]> {
    await delay();
    const allocations = getStoredItem<ContactAllocation>(STORAGE_KEYS.ALLOCATIONS, []);
    const created: ContactAllocation[] = allocationsData.map((ad, idx) => ({
      ...ad,
      id: `alc_${Date.now()}_${idx}`,
    }));
    allocations.push(...created);
    setStoredItem(STORAGE_KEYS.ALLOCATIONS, allocations);
    return created;
  }
}

export class MockCallLogRepository implements ICallLogRepository {
  async getAll(): Promise<CallLog[]> {
    await delay();
    return getStoredItem<CallLog>(STORAGE_KEYS.CALL_LOGS, []);
  }

  async getByContactId(contactId: string): Promise<CallLog[]> {
    await delay();
    const logs = getStoredItem<CallLog>(STORAGE_KEYS.CALL_LOGS, []);
    return logs.filter((l) => l.contactId === contactId);
  }

  async getByMemberId(memberId: string): Promise<CallLog[]> {
    await delay();
    const logs = getStoredItem<CallLog>(STORAGE_KEYS.CALL_LOGS, []);
    return logs.filter((l) => l.teamMemberId === memberId);
  }

  async getByTeamId(teamId: string): Promise<CallLog[]> {
    await delay();
    const logs = getStoredItem<CallLog>(STORAGE_KEYS.CALL_LOGS, []);
    return logs.filter((l) => l.teamId === teamId);
  }

  async create(logData: Omit<CallLog, 'id'>): Promise<CallLog> {
    await delay();
    const logs = getStoredItem<CallLog>(STORAGE_KEYS.CALL_LOGS, []);
    const newLog: CallLog = {
      ...logData,
      id: `cll_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
    logs.push(newLog);
    setStoredItem(STORAGE_KEYS.CALL_LOGS, logs);
    return newLog;
  }

  async update(id: string, updates: Partial<CallLog>): Promise<CallLog> {
    await delay();
    const logs = getStoredItem<CallLog>(STORAGE_KEYS.CALL_LOGS, []);
    const idx = logs.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error('Call log not found');
    const updated = { ...logs[idx], ...updates };
    logs[idx] = updated;
    setStoredItem(STORAGE_KEYS.CALL_LOGS, logs);
    return updated;
  }
}

export class MockCustomerRepository implements ICustomerRepository {
  async getAll(): Promise<Customer[]> {
    await delay();
    return getStoredItem<Customer>(STORAGE_KEYS.CUSTOMERS, []);
  }

  async getById(id: string): Promise<Customer | null> {
    await delay();
    const customers = getStoredItem<Customer>(STORAGE_KEYS.CUSTOMERS, []);
    return customers.find((c) => c.id === id) || null;
  }

  async getByContactId(contactId: string): Promise<Customer | null> {
    await delay();
    const customers = getStoredItem<Customer>(STORAGE_KEYS.CUSTOMERS, []);
    return customers.find((c) => c.contactId === contactId) || null;
  }

  async getByTeamId(teamId: string): Promise<Customer[]> {
    await delay();
    const customers = getStoredItem<Customer>(STORAGE_KEYS.CUSTOMERS, []);
    return customers.filter((c) => c.teamId === teamId);
  }

  async getBySupervisorId(supervisorId: string): Promise<Customer[]> {
    await delay();
    const customers = getStoredItem<Customer>(STORAGE_KEYS.CUSTOMERS, []);
    return customers.filter((c) => c.supervisorId === supervisorId);
  }

  async getByMemberId(memberId: string): Promise<Customer[]> {
    await delay();
    const customers = getStoredItem<Customer>(STORAGE_KEYS.CUSTOMERS, []);
    return customers.filter((c) => c.responsibleTeamMemberId === memberId);
  }

  async create(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    await delay();
    const customers = getStoredItem<Customer>(STORAGE_KEYS.CUSTOMERS, []);
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      ...customerData,
      id: `cst_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now,
    };
    customers.push(newCustomer);
    setStoredItem(STORAGE_KEYS.CUSTOMERS, customers);
    return newCustomer;
  }

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    await delay();
    const customers = getStoredItem<Customer>(STORAGE_KEYS.CUSTOMERS, []);
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Customer not found');
    const updated = { ...customers[idx], ...updates, updatedAt: new Date().toISOString() };
    customers[idx] = updated;
    setStoredItem(STORAGE_KEYS.CUSTOMERS, customers);
    return updated;
  }
}

export class MockOrderRepository implements IOrderRepository {
  async getAll(): Promise<Order[]> {
    await delay();
    return getStoredItem<Order>(STORAGE_KEYS.ORDERS, []);
  }

  async getById(id: string): Promise<Order | null> {
    await delay();
    const orders = getStoredItem<Order>(STORAGE_KEYS.ORDERS, []);
    return orders.find((o) => o.id === id) || null;
  }

  async getByCustomerId(customerId: string): Promise<Order[]> {
    await delay();
    const orders = getStoredItem<Order>(STORAGE_KEYS.ORDERS, []);
    return orders.filter((o) => o.customerId === customerId);
  }

  async getByTeamId(teamId: string): Promise<Order[]> {
    await delay();
    const orders = getStoredItem<Order>(STORAGE_KEYS.ORDERS, []);
    return orders.filter((o) => o.teamId === teamId);
  }

  async getBySupervisorId(supervisorId: string): Promise<Order[]> {
    await delay();
    const orders = getStoredItem<Order>(STORAGE_KEYS.ORDERS, []);
    return orders.filter((o) => o.supervisorId === supervisorId);
  }

  async getByMemberId(memberId: string): Promise<Order[]> {
    await delay();
    const orders = getStoredItem<Order>(STORAGE_KEYS.ORDERS, []);
    return orders.filter((o) => o.teamMemberId === memberId);
  }

  async create(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'> & { orderNumber?: string }): Promise<Order> {
    await delay();
    const orders = getStoredItem<Order>(STORAGE_KEYS.ORDERS, []);
    const now = new Date().toISOString();
    const newOrder: Order = {
      ...orderData,
      orderNumber: orderData.orderNumber || `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
      id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now,
    };
    orders.push(newOrder);
    setStoredItem(STORAGE_KEYS.ORDERS, orders);
    return newOrder;
  }

  async updateStatus(id: string, status: OrderStatus, remarks?: string): Promise<Order> {
    await delay();
    const orders = getStoredItem<Order>(STORAGE_KEYS.ORDERS, []);
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) throw new Error('Order not found');
    const updated = {
      ...orders[idx],
      status,
      remarks: remarks !== undefined ? remarks : orders[idx].remarks,
      updatedAt: new Date().toISOString(),
    };
    orders[idx] = updated;
    setStoredItem(STORAGE_KEYS.ORDERS, orders);
    return updated;
  }
}

export class MockDeliveryStatusHistoryRepository implements IDeliveryStatusHistoryRepository {
  async getAll(): Promise<DeliveryStatusHistory[]> {
    await delay();
    return getStoredItem<DeliveryStatusHistory>(STORAGE_KEYS.DELIVERY_HISTORIES, []);
  }

  async getByOrderId(orderId: string): Promise<DeliveryStatusHistory[]> {
    await delay();
    const histories = getStoredItem<DeliveryStatusHistory>(STORAGE_KEYS.DELIVERY_HISTORIES, []);
    return histories.filter((h) => h.orderId === orderId);
  }

  async create(historyData: Omit<DeliveryStatusHistory, 'id' | 'createdAt'>): Promise<DeliveryStatusHistory> {
    await delay();
    const histories = getStoredItem<DeliveryStatusHistory>(STORAGE_KEYS.DELIVERY_HISTORIES, []);
    const newHistory: DeliveryStatusHistory = {
      ...historyData,
      id: `dsh_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    histories.push(newHistory);
    setStoredItem(STORAGE_KEYS.DELIVERY_HISTORIES, histories);
    return newHistory;
  }
}

export class MockActivityLogRepository implements IActivityLogRepository {
  async getAll(): Promise<ActivityLog[]> {
    await delay();
    const logs = getStoredItem<ActivityLog>(STORAGE_KEYS.ACTIVITY_LOGS, []);
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getByUserId(userId: string): Promise<ActivityLog[]> {
    await delay();
    const logs = getStoredItem<ActivityLog>(STORAGE_KEYS.ACTIVITY_LOGS, []);
    return logs.filter((l) => l.userId === userId);
  }

  async getRecentWithinMonth(userId?: string): Promise<ActivityLog[]> {
    await delay();
    const logs = getStoredItem<ActivityLog>(STORAGE_KEYS.ACTIVITY_LOGS, []);
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const cutoffTime = oneMonthAgo.getTime();

    return logs
      .filter((l) => {
        const matchesUser = !userId || l.userId === userId;
        const isRecent = new Date(l.createdAt).getTime() >= cutoffTime;
        return matchesUser && isRecent;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    await delay();
    const logs = getStoredItem<ActivityLog>(STORAGE_KEYS.ACTIVITY_LOGS, []);
    return logs.filter((l) => l.entityType === entityType && l.entityId === entityId);
  }

  async create(logData: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog> {
    await delay();
    const logs = getStoredItem<ActivityLog>(STORAGE_KEYS.ACTIVITY_LOGS, []);
    const newLog: ActivityLog = {
      ...logData,
      id: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    logs.push(newLog);
    setStoredItem(STORAGE_KEYS.ACTIVITY_LOGS, logs);
    return newLog;
  }
}

export class MockExpenseRepository implements IExpenseRepository {
  async getAll(): Promise<Expense[]> {
    await delay();
    return getStoredItem<Expense>(STORAGE_KEYS.EXPENSES, []);
  }

  async getCategories(): Promise<ExpenseCategory[]> {
    await delay();
    return getStoredItem<ExpenseCategory>(STORAGE_KEYS.EXPENSE_CATEGORIES, []);
  }

  async create(expenseData: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
    await delay();
    const expenses = getStoredItem<Expense>(STORAGE_KEYS.EXPENSES, []);
    const newExpense: Expense = {
      ...expenseData,
      id: `exp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    expenses.push(newExpense);
    setStoredItem(STORAGE_KEYS.EXPENSES, expenses);
    return newExpense;
  }

  async createCategory(categoryData: Omit<ExpenseCategory, 'id'>): Promise<ExpenseCategory> {
    await delay();
    const categories = getStoredItem<ExpenseCategory>(STORAGE_KEYS.EXPENSE_CATEGORIES, []);
    const newCategory: ExpenseCategory = {
      ...categoryData,
      id: `cat_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
    categories.push(newCategory);
    setStoredItem(STORAGE_KEYS.EXPENSE_CATEGORIES, categories);
    return newCategory;
  }
}

export class MockEmailNotificationRepository implements IEmailNotificationRepository {
  async getAll(): Promise<EmailNotification[]> {
    await delay();
    return getStoredItem<EmailNotification>(STORAGE_KEYS.EMAIL_NOTIFICATIONS, []);
  }

  async getByCustomerId(customerId: string): Promise<EmailNotification[]> {
    await delay();
    const list = getStoredItem<EmailNotification>(STORAGE_KEYS.EMAIL_NOTIFICATIONS, []);
    return list.filter((e) => e.customerId === customerId);
  }

  async getByOrderId(orderId: string): Promise<EmailNotification[]> {
    await delay();
    const list = getStoredItem<EmailNotification>(STORAGE_KEYS.EMAIL_NOTIFICATIONS, []);
    return list.filter((e) => e.orderId === orderId);
  }

  async create(data: Omit<EmailNotification, 'id' | 'sentAt'>): Promise<EmailNotification> {
    await delay();
    const list = getStoredItem<EmailNotification>(STORAGE_KEYS.EMAIL_NOTIFICATIONS, []);
    const newRecord: EmailNotification = {
      ...data,
      id: `eml_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      sentAt: new Date().toISOString(),
    };
    list.push(newRecord);
    setStoredItem(STORAGE_KEYS.EMAIL_NOTIFICATIONS, list);
    return newRecord;
  }
}

export class MockProductRepository implements IProductRepository {
  async getAll(): Promise<Product[]> {
    await delay();
    return getStoredItem<Product>(STORAGE_KEYS.PRODUCTS, []);
  }

  async getById(id: string): Promise<Product | null> {
    await delay();
    const products = getStoredItem<Product>(STORAGE_KEYS.PRODUCTS, []);
    return products.find((p) => p.id === id) || null;
  }

  async getByTeamId(teamId: string): Promise<Product[]> {
    await delay();
    const products = getStoredItem<Product>(STORAGE_KEYS.PRODUCTS, []);
    return products.filter((p) => p.teamId === teamId);
  }

  async create(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    await delay();
    const products = getStoredItem<Product>(STORAGE_KEYS.PRODUCTS, []);
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...productData,
      id: `prd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now,
    };
    products.push(newProduct);
    setStoredItem(STORAGE_KEYS.PRODUCTS, products);

    if (newProduct.currentStock > 0) {
      const stockLogs = getStoredItem<StockActivityLog>(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, []);
      stockLogs.push({
        id: `skl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        productId: newProduct.id,
        productName: newProduct.name,
        teamId: newProduct.teamId,
        action: 'ADD',
        quantity: newProduct.currentStock,
        previousStock: 0,
        newStock: newProduct.currentStock,
        previousCostPrice: newProduct.costPrice,
        newCostPrice: newProduct.costPrice,
        previousSellingPrice: newProduct.sellingPrice,
        newSellingPrice: newProduct.sellingPrice,
        performedBy: 'admin',
        performedByName: 'Admin',
        approvalStatus: 'APPROVED',
        createdAt: now,
      });
      setStoredItem(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, stockLogs);
    }

    return newProduct;
  }

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    await delay();
    const products = getStoredItem<Product>(STORAGE_KEYS.PRODUCTS, []);
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    const updated = { ...products[idx], ...updates, updatedAt: new Date().toISOString() };
    products[idx] = updated;
    setStoredItem(STORAGE_KEYS.PRODUCTS, products);
    return updated;
  }

  async updateStock(id: string, stockDelta: number): Promise<Product> {
    await delay();
    const products = getStoredItem<Product>(STORAGE_KEYS.PRODUCTS, []);
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    const newStock = Math.max(0, products[idx].currentStock + stockDelta);
    const updated = { ...products[idx], currentStock: newStock, updatedAt: new Date().toISOString() };
    products[idx] = updated;
    setStoredItem(STORAGE_KEYS.PRODUCTS, products);
    return updated;
  }

  async reportDamage(id: string, quantity: number): Promise<Product> {
    await delay();
    const products = getStoredItem<Product>(STORAGE_KEYS.PRODUCTS, []);
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    const newStock = Math.max(0, products[idx].currentStock - quantity);
    const newDamaged = (products[idx].damagedStock || 0) + quantity;
    const updated = { ...products[idx], currentStock: newStock, damagedStock: newDamaged, updatedAt: new Date().toISOString() };
    products[idx] = updated;
    setStoredItem(STORAGE_KEYS.PRODUCTS, products);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await delay();
    const products = getStoredItem<Product>(STORAGE_KEYS.PRODUCTS, []);
    const filtered = products.filter((p) => p.id !== id);
    setStoredItem(STORAGE_KEYS.PRODUCTS, filtered);
  }
}

export class MockStockActivityLogRepository implements IStockActivityLogRepository {
  async getAll(): Promise<StockActivityLog[]> {
    await delay();
    const logs = getStoredItem<StockActivityLog>(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, []);
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getByProductId(productId: string): Promise<StockActivityLog[]> {
    await delay();
    const logs = getStoredItem<StockActivityLog>(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, []);
    return logs.filter((l) => l.productId === productId);
  }

  async getByTeamId(teamId: string): Promise<StockActivityLog[]> {
    await delay();
    const logs = getStoredItem<StockActivityLog>(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, []);
    return logs.filter((l) => l.teamId === teamId);
  }

  async create(logData: Omit<StockActivityLog, 'id' | 'createdAt'>): Promise<StockActivityLog> {
    await delay();
    const logs = getStoredItem<StockActivityLog>(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, []);
    const newLog: StockActivityLog = {
      ...logData,
      id: `skl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };
    logs.push(newLog);
    setStoredItem(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, logs);
    return newLog;
  }
}

export class MockApprovalRequestRepository implements IApprovalRequestRepository {
  async getAll(): Promise<ApprovalRequest[]> {
    await delay();
    const requests = getStoredItem<ApprovalRequest>(STORAGE_KEYS.APPROVAL_REQUESTS, []);
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getById(id: string): Promise<ApprovalRequest | null> {
    await delay();
    const requests = getStoredItem<ApprovalRequest>(STORAGE_KEYS.APPROVAL_REQUESTS, []);
    return requests.find((r) => r.id === id) || null;
  }

  async getByStatus(status: ApprovalStatus): Promise<ApprovalRequest[]> {
    await delay();
    const requests = getStoredItem<ApprovalRequest>(STORAGE_KEYS.APPROVAL_REQUESTS, []);
    return requests.filter((r) => r.status === status);
  }

  async getByTeamId(teamId: string): Promise<ApprovalRequest[]> {
    await delay();
    const requests = getStoredItem<ApprovalRequest>(STORAGE_KEYS.APPROVAL_REQUESTS, []);
    return requests.filter((r) => r.teamId === teamId);
  }

  private applyApprovedAction(updated: ApprovalRequest) {
    const products = getStoredItem<Product>(STORAGE_KEYS.PRODUCTS, []);
    const stockLogs = getStoredItem<StockActivityLog>(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, []);

    if (updated.requestType === 'STOCK_ADDITION' && updated.items && updated.items.length > 0) {
      for (const item of updated.items) {
        const pIdx = products.findIndex((p) => p.id === item.productId);
        if (pIdx !== -1) {
          const prod = products[pIdx];
          const prevStock = prod.currentStock;
          const newStock = prod.currentStock + item.quantity;
          products[pIdx].currentStock = newStock;
          if (item.pricingMode === 'GLOBAL' && item.proposedSellingPrice) {
            products[pIdx].sellingPrice = item.proposedSellingPrice;
          }
          if (item.unitCostPrice) {
            products[pIdx].costPrice = item.unitCostPrice;
          }
          products[pIdx].updatedAt = new Date().toISOString();

          stockLogs.push({
            id: `skl_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            productId: item.productId,
            productName: item.productName || prod.name,
            teamId: updated.teamId,
            action: 'ADD',
            quantity: item.quantity,
            previousStock: prevStock,
            newStock: newStock,
            previousCostPrice: prod.costPrice,
            newCostPrice: item.unitCostPrice || prod.costPrice,
            previousSellingPrice: prod.sellingPrice,
            newSellingPrice: item.proposedSellingPrice || prod.sellingPrice,
            performedBy: updated.reviewedById || updated.requestedById,
            performedByName: updated.reviewedByName || updated.requestedByName,
            approvalRequestId: updated.id,
            approvalStatus: 'APPROVED',
            createdAt: new Date().toISOString(),
          });
        }
      }
      setStoredItem(STORAGE_KEYS.PRODUCTS, products);
      setStoredItem(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, stockLogs);
    } else {
      const pIdx = products.findIndex((p) => p.id === updated.productId);
      if (pIdx !== -1) {
        const prod = products[pIdx];
        let actionType: 'ADD' | 'REMOVE' | 'ADJUST' | 'PRICE_CHANGE' = 'ADD';
        let prevStock = prod.currentStock;
        let newStock = prod.currentStock;
        let prevCost = prod.costPrice;
        let newCost = prod.costPrice;
        let prevSelling = prod.sellingPrice;
        let newSelling = prod.sellingPrice;

        if (updated.requestType === 'STOCK_ADDITION' && updated.quantity) {
          actionType = 'ADD';
          newStock = prod.currentStock + updated.quantity;
          products[pIdx].currentStock = newStock;
          if (updated.pricingMode === 'GLOBAL' && updated.proposedSellingPrice) {
            products[pIdx].sellingPrice = updated.proposedSellingPrice;
            newSelling = updated.proposedSellingPrice;
          }
          if (updated.unitCostPrice) {
            products[pIdx].costPrice = updated.unitCostPrice;
            newCost = updated.unitCostPrice;
          }
        } else if (updated.requestType === 'PRODUCT_COST_PRICE_CHANGE' && updated.newValue !== undefined) {
          actionType = 'PRICE_CHANGE';
          newCost = updated.newValue;
          products[pIdx].costPrice = newCost;
        } else if (updated.requestType === 'PRODUCT_SELLING_PRICE_CHANGE' && updated.newValue !== undefined) {
          actionType = 'PRICE_CHANGE';
          newSelling = updated.newValue;
          products[pIdx].sellingPrice = newSelling;
        }
        products[pIdx].updatedAt = new Date().toISOString();
        setStoredItem(STORAGE_KEYS.PRODUCTS, products);

        stockLogs.push({
          id: `skl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          productId: prod.id,
          productName: prod.name,
          teamId: prod.teamId,
          action: actionType,
          quantity: updated.quantity || 0,
          previousStock: prevStock,
          newStock: newStock,
          previousCostPrice: prevCost,
          newCostPrice: newCost,
          previousSellingPrice: prevSelling,
          newSellingPrice: newSelling,
          performedBy: updated.reviewedById || updated.requestedById,
          performedByName: updated.reviewedByName || updated.requestedByName,
          approvalRequestId: updated.id,
          approvalStatus: 'APPROVED',
          createdAt: new Date().toISOString(),
        });
        setStoredItem(STORAGE_KEYS.STOCK_ACTIVITY_LOGS, stockLogs);
      }
    }
  }

  async create(requestData: Omit<ApprovalRequest, 'id' | 'createdAt' | 'status'> & { status?: ApprovalStatus }): Promise<ApprovalRequest> {
    await delay();
    const requests = getStoredItem<ApprovalRequest>(STORAGE_KEYS.APPROVAL_REQUESTS, []);
    const users = getStoredItem<User>(STORAGE_KEYS.USERS, []);
    const requester = users.find((u) => u.id === requestData.requestedById);
    const isAdmin = requester?.role === 'ADMIN' || requestData.requestedByName?.toLowerCase().includes('admin') || !requester;
    const status: ApprovalStatus = requestData.status || (isAdmin ? 'APPROVED' : 'PENDING');

    const newReq: ApprovalRequest = {
      ...requestData,
      id: `apr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      status,
      reviewedById: isAdmin ? requestData.requestedById : undefined,
      reviewedByName: isAdmin ? requestData.requestedByName : undefined,
      reviewedDate: isAdmin ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    };
    requests.push(newReq);
    setStoredItem(STORAGE_KEYS.APPROVAL_REQUESTS, requests);

    if (status === 'APPROVED') {
      this.applyApprovedAction(newReq);
    }

    return newReq;
  }

  async review(id: string, status: 'APPROVED' | 'REJECTED', reviewedBy: User, rejectionReason?: string): Promise<ApprovalRequest> {
    await delay();
    const requests = getStoredItem<ApprovalRequest>(STORAGE_KEYS.APPROVAL_REQUESTS, []);
    const idx = requests.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Approval request not found');

    const updated: ApprovalRequest = {
      ...requests[idx],
      status,
      reviewedById: reviewedBy.id,
      reviewedByName: reviewedBy.fullName,
      reviewedDate: new Date().toISOString(),
      rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
    };
    requests[idx] = updated;
    setStoredItem(STORAGE_KEYS.APPROVAL_REQUESTS, requests);

    if (status === 'APPROVED') {
      this.applyApprovedAction(updated);
    }

    return updated;
  }
}

export class MockPettyCashRepository implements IPettyCashRepository {
  async getWallet(teamId?: string): Promise<PettyCashWallet> {
    await delay();
    const wallets = getStoredItem<PettyCashWallet>(STORAGE_KEYS.PETTY_CASH_WALLET, []);
    let wallet = wallets.find((w) => !teamId || w.teamId === teamId);

    if (!wallet) {
      wallet = {
        id: `wallet_${teamId || 'main'}`,
        teamId: teamId || 'team_001',
        allocatedAmount: 50000,
        usedAmount: 0,
        remainingBalance: 50000,
        updatedAt: new Date().toISOString(),
      };
      wallets.push(wallet);
      setStoredItem(STORAGE_KEYS.PETTY_CASH_WALLET, wallets);
    }
    return wallet;
  }

  async getTransactions(): Promise<PettyCashTransaction[]> {
    await delay();
    const txs = getStoredItem<PettyCashTransaction>(STORAGE_KEYS.PETTY_CASH_TRANSACTIONS, []);
    return txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async allocate(amount: number, user: User, reason = 'Petty Cash Allocation'): Promise<PettyCashWallet> {
    await delay();
    const wallet = await this.getWallet(user.teamId || undefined);
    const wallets = getStoredItem<PettyCashWallet>(STORAGE_KEYS.PETTY_CASH_WALLET, []);
    const idx = wallets.findIndex((w) => w.id === wallet.id);

    const newAllocated = wallet.allocatedAmount + amount;
    const newRemaining = wallet.remainingBalance + amount;
    const updatedWallet: PettyCashWallet = {
      ...wallet,
      allocatedAmount: newAllocated,
      remainingBalance: newRemaining,
      updatedAt: new Date().toISOString(),
    };
    if (idx !== -1) {
      wallets[idx] = updatedWallet;
    } else {
      wallets.push(updatedWallet);
    }
    setStoredItem(STORAGE_KEYS.PETTY_CASH_WALLET, wallets);

    // Record transaction
    const txs = getStoredItem<PettyCashTransaction>(STORAGE_KEYS.PETTY_CASH_TRANSACTIONS, []);
    txs.push({
      id: `pct_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      transactionType: 'ALLOCATION',
      reason,
      category: 'Allocation',
      amount,
      date: new Date().toISOString().split('T')[0],
      description: `Allocated LKR ${amount.toLocaleString()} by ${user.fullName}`,
      userId: user.id,
      userName: user.fullName,
      remainingBalance: newRemaining,
      createdAt: new Date().toISOString(),
    });
    setStoredItem(STORAGE_KEYS.PETTY_CASH_TRANSACTIONS, txs);

    return updatedWallet;
  }

  async recordExpense(
    data: { amount: number; reason: string; category: string; description: string; date: string },
    user: User
  ): Promise<PettyCashTransaction> {
    await delay();
    const wallet = await this.getWallet(user.teamId || undefined);

    if (data.amount > wallet.remainingBalance) {
      throw new Error(`Expense amount (LKR ${data.amount.toLocaleString()}) exceeds available petty cash balance (LKR ${wallet.remainingBalance.toLocaleString()})`);
    }

    const wallets = getStoredItem<PettyCashWallet>(STORAGE_KEYS.PETTY_CASH_WALLET, []);
    const idx = wallets.findIndex((w) => w.id === wallet.id);

    const newUsed = wallet.usedAmount + data.amount;
    const newRemaining = wallet.remainingBalance - data.amount;

    const updatedWallet: PettyCashWallet = {
      ...wallet,
      usedAmount: newUsed,
      remainingBalance: newRemaining,
      updatedAt: new Date().toISOString(),
    };
    if (idx !== -1) wallets[idx] = updatedWallet;
    setStoredItem(STORAGE_KEYS.PETTY_CASH_WALLET, wallets);

    const txs = getStoredItem<PettyCashTransaction>(STORAGE_KEYS.PETTY_CASH_TRANSACTIONS, []);
    const newTx: PettyCashTransaction = {
      id: `pct_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      transactionType: 'EXPENSE',
      reason: data.reason,
      category: data.category,
      amount: data.amount,
      date: data.date,
      description: data.description,
      userId: user.id,
      userName: user.fullName,
      remainingBalance: newRemaining,
      createdAt: new Date().toISOString(),
    };
    txs.push(newTx);
    setStoredItem(STORAGE_KEYS.PETTY_CASH_TRANSACTIONS, txs);

    return newTx;
  }
}

export class MockSalesTargetRepository implements ISalesTargetRepository {
  private getStorageKey(): string {
    return 'crm_sales_targets';
  }

  async getAll(month?: string, teamId?: string): Promise<TeamSalesTarget[]> {
    await delay();
    const targets = getStoredItem<TeamSalesTarget>(this.getStorageKey(), []);
    return targets.filter((t) => (!month || t.month === month) && (!teamId || t.teamId === teamId));
  }

  async getById(id: string): Promise<TeamSalesTarget | null> {
    await delay();
    const targets = getStoredItem<TeamSalesTarget>(this.getStorageKey(), []);
    return targets.find((t) => t.id === id) || null;
  }

  async upsert(target: {
    teamId: string;
    month: string;
    targetAmount: number;
    notes?: string;
    tiers: TeamTargetTier[];
  }): Promise<TeamSalesTarget> {
    await delay();
    const targets = getStoredItem<TeamSalesTarget>(this.getStorageKey(), []);
    const idx = targets.findIndex((t) => t.teamId === target.teamId && t.month === target.month);

    const now = new Date().toISOString();
    const newTarget: TeamSalesTarget = {
      id: idx !== -1 ? targets[idx].id : `target_${Date.now()}`,
      teamId: target.teamId,
      month: target.month,
      targetAmount: target.targetAmount,
      notes: target.notes,
      tiers: target.tiers.map((t, i) => ({
        id: t.id || `tier_${Date.now()}_${i}`,
        minPercentage: t.minPercentage,
        allowanceAmount: t.allowanceAmount,
        title: t.title || `${t.minPercentage}% Tier`,
      })),
      createdAt: idx !== -1 ? targets[idx].createdAt : now,
      updatedAt: now,
    };

    if (idx !== -1) {
      targets[idx] = newTarget;
    } else {
      targets.push(newTarget);
    }
    setStoredItem(this.getStorageKey(), targets);
    return newTarget;
  }

  async update(id: string, updates: Partial<TeamSalesTarget>): Promise<TeamSalesTarget> {
    await delay();
    const targets = getStoredItem<TeamSalesTarget>(this.getStorageKey(), []);
    const idx = targets.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Sales target not found');
    const updated = { ...targets[idx], ...updates, updatedAt: new Date().toISOString() };
    targets[idx] = updated;
    setStoredItem(this.getStorageKey(), targets);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await delay();
    const targets = getStoredItem<TeamSalesTarget>(this.getStorageKey(), []);
    const filtered = targets.filter((t) => t.id !== id);
    setStoredItem(this.getStorageKey(), filtered);
  }
}
