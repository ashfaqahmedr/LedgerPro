/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Building2, 
  Scale, 
  FileText, 
  ArrowLeft, 
  Sun, 
  Moon, 
  Download, 
  Upload,
  ChevronRight,
  TrendingUp,
  LayoutDashboard,
  Settings,
  X,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Calendar,
  Filter,
  FileDown,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---
type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

interface Entry {
  id: number;
  transactionId: number;
  date: string;
  description: string;
  type: 'debit' | 'credit';
  amount: number;
  reference: string;
  contraAccountId: number;
}

interface Account {
  id: number;
  name: string;
  code: string;
  type: AccountType;
  description: string;
  openingBalance: number;
  entries: Entry[];
  createdAt: string;
}

interface Company {
  id: number;
  name: string;
  industry: string;
  currency: string;
  accounts: Account[];
  createdAt: string;
}

interface AppData {
  companies: Company[];
  nextId: number;
}

type DateRangeType = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom';

interface DateRange {
  start: string;
  end: string;
}

const DATE_RANGE_OPTIONS: { value: DateRangeType; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
];

const getDatesForRange = (range: DateRangeType, custom?: DateRange): DateRange => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (range) {
    case 'today':
      return { start: formatDate(today), end: formatDate(today) };
    case 'yesterday': {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return { start: formatDate(d), end: formatDate(d) };
    }
    case 'this_week': {
      const d = new Date(today);
      d.setDate(d.getDate() - d.getDay());
      return { start: formatDate(d), end: formatDate(today) };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(start), end: formatDate(today) };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(start), end: formatDate(end) };
    }
    case 'this_year': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { start: formatDate(start), end: formatDate(today) };
    }
    case 'last_year': {
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear() - 1, 11, 31);
      return { start: formatDate(start), end: formatDate(end) };
    }
    case 'custom':
      return custom || { start: formatDate(today), end: formatDate(today) };
    default:
      return { start: '1970-01-01', end: formatDate(today) };
  }
};

// --- Constants ---
const ACCOUNT_TYPES: { value: AccountType; label: string; category: string; normal: 'debit' | 'credit' }[] = [
  { value: 'asset', label: 'Asset', category: 'Balance Sheet', normal: 'debit' },
  { value: 'liability', label: 'Liability', category: 'Balance Sheet', normal: 'credit' },
  { value: 'equity', label: 'Equity', category: 'Balance Sheet', normal: 'credit' },
  { value: 'revenue', label: 'Revenue', category: 'Income Statement', normal: 'credit' },
  { value: 'expense', label: 'Expense', category: 'Income Statement', normal: 'debit' },
];

const DB_NAME = "LedgerProDB";
const STORE_NAME = "AppData";
const ACTIVE_COMPANY_KEY = "ledgerpro_active_company_id";

// --- Sub-components for better stability (outside App to prevent remounting) ---
const Modal = ({ title, children, onConfirm, confirmText = "Confirm", onClose }: any) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="w-full max-w-md bg-[var(--card)] rounded-3xl overflow-hidden shadow-2xl border border-[var(--border)]"
    >
      <div className="px-6 py-5 border-b border-[var(--border)] flex justify-between items-center">
        <h3 className="text-xl font-bold text-[var(--text-bright)]">{title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--text)]">
          <X size={20} />
        </button>
      </div>
      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto native-scroll">
        {children}
      </div>
      <div className="p-6 bg-[var(--surface)] flex gap-3 border-t border-[var(--border)]">
        <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] font-bold text-[var(--muted)] hover:bg-[var(--card)] transition-colors">Cancel</button>
        <button onClick={onConfirm} className="flex-1 btn-primary">{confirmText}</button>
      </div>
    </motion.div>
  </div>
);

const EllipsisMenu = ({ options }: { options: { label: string; icon: any; onClick: () => void; danger?: boolean }[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
        <MoreVertical size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-10 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-[70] overflow-hidden"
            >
              {options.map((opt, i) => (
                <button 
                  key={i}
                  onClick={(e) => { e.stopPropagation(); opt.onClick(); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-[var(--surface)] transition-colors ${opt.danger ? 'text-red-400' : 'text-[var(--text)]'}`}
                >
                  <opt.icon size={16} />
                  {opt.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const SearchableSelect = ({ label, value, onChange, options, placeholder, colorClass, onAddClick }: any) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const filtered = options.filter((o: any) => o.label.toLowerCase().includes(search.toLowerCase()));
  const selected = options.find((o: any) => o.value === value);

  return (
    <div className="space-y-1.5 relative">
      <label className={`text-[10px] font-black uppercase ${colorClass}`}>{label}</label>
      <div 
        onClick={() => setOpen(!open)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-3 text-sm flex justify-between items-center cursor-pointer hover:border-[var(--muted)] transition-colors border-[var(--border)]"
      >
        <span className={selected ? 'text-[var(--text-bright)] font-medium' : 'text-[var(--muted)]'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronRight size={16} className={`text-[var(--muted)] transition-transform ${open ? 'rotate-90' : ''}`} />
      </div>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              className="absolute left-0 right-0 top-[100%] mt-2 z-[120] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-60"
            >
              <div className="p-2 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg py-1.5 pl-8 pr-2 text-xs outline-none focus:border-blue-500/50 text-[var(--text-bright)]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="overflow-y-auto native-scroll">
                {filtered.length > 0 ? (
                  filtered.map((opt: any) => (
                    <button 
                      key={opt.value}
                      onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false); setSearch(""); }}
                      className={`w-full text-left px-4 py-3 text-xs font-medium hover:bg-[var(--surface)] transition-colors border-b border-[var(--border)] last:border-0 ${value === opt.value ? 'bg-blue-500/10 text-blue-400' : 'text-[var(--text)]'}`}
                    >
                      {opt.label}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-[var(--muted)] italic">No matches</div>
                )}
                {onAddClick && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setOpen(false); onAddClick(); }}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-blue-400 hover:bg-blue-500/10 transition-colors flex items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)]"
                  >
                    <Plus size={14} />
                    Add New Account
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const DateFilter = ({ range, setRange, custom, setCustom }: any) => {
  const [open, setOpen] = useState(false);
  const selectedLabel = DATE_RANGE_OPTIONS.find(o => o.value === range)?.label || "Select Range";

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-bright)] hover:bg-[var(--border)] transition-all"
      >
        <Calendar size={14} className="text-blue-500" />
        {selectedLabel}
        {range === 'custom' && custom.start && ` (${custom.start})`}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-[90] overflow-hidden"
            >
              {DATE_RANGE_OPTIONS.map(opt => (
                <button 
                  key={opt.value}
                  onClick={() => { setRange(opt.value); setOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-xs font-medium hover:bg-[var(--surface)] transition-colors ${range === opt.value ? 'text-blue-400 bg-blue-500/5' : 'text-[var(--text)]'}`}
                >
                  {opt.label}
                </button>
              ))}
              {range === 'custom' && (
                <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)] space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--muted)]">Start Date</label>
                    <input 
                      type="date" 
                      value={custom.start} 
                      onChange={e => setCustom({...custom, start: e.target.value})}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-2 text-xs text-[var(--text-bright)] outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--muted)]">End Date</label>
                    <input 
                      type="date" 
                      value={custom.end} 
                      onChange={e => setCustom({...custom, end: e.target.value})}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-2 text-xs text-[var(--text-bright)] outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Database Helpers ---
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const loadAppData = async (): Promise<AppData> => {
  try {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get("app_state");
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || { companies: [], nextId: 1 });
      request.onerror = () => resolve({ companies: [], nextId: 1 });
    });
  } catch {
    return { companies: [], nextId: 1 };
  }
};

const saveAppData = async (data: AppData) => {
  try {
    const db = await initDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(data, "app_state");
  } catch (err) {
    console.error("Save error:", err);
  }
};

// --- App Component ---
export default function App() {
  const [data, setData] = useState<AppData>({ companies: [], nextId: 1 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [view, setView] = useState<'companies' | 'dashboard' | 'accounts' | 'journal' | 'balanceSheet'>('companies');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState<string | null>(null);
  const [previousModal, setPreviousModal] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [journalSearch, setJournalSearch] = useState("");
  const [journalSort, setJournalSort] = useState<'desc' | 'asc'>('desc');
  const [rangeType, setRangeType] = useState<DateRangeType>('this_month');
  const [customRange, setCustomRange] = useState<DateRange>({ 
    start: new Date().toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });

  const activeRange = useMemo(() => getDatesForRange(rangeType, customRange), [rangeType, customRange]);

  // Initialize
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    loadAppData().then(d => {
      setData(d);
      const savedCid = localStorage.getItem(ACTIVE_COMPANY_KEY);
      if (savedCid && d.companies.some(c => c.id === parseInt(savedCid))) {
        setSelectedCompanyId(parseInt(savedCid));
        setView('accounts');
      }
      setIsLoaded(true);
    });
  }, []);

  // Sync Data
  useEffect(() => {
    if (isLoaded) saveAppData(data);
  }, [data, isLoaded]);

  // Theme support
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getNextId = useCallback(() => {
    const id = data.nextId;
    setData(prev => ({ ...prev, nextId: id + 1 }));
    return id;
  }, [data.nextId]);

  const activeCompany = useMemo(() => 
    data.companies.find(c => c.id === selectedCompanyId) || null
  , [data.companies, selectedCompanyId]);

  const activeAccount = useMemo(() => 
    activeCompany?.accounts.find(a => a.id === selectedAccountId) || null
  , [activeCompany, selectedAccountId]);

  // --- Handlers ---
  const handleCreateCompany = () => {
    if (!formData.name) return notify("Name is required", "error");
    const newCompany: Company = {
      id: getNextId(),
      name: formData.name,
      industry: formData.industry || "",
      currency: formData.currency || "PKR",
      accounts: [],
      createdAt: new Date().toISOString()
    };
    setData(prev => ({ ...prev, companies: [...prev.companies, newCompany] }));
    setSelectedCompanyId(newCompany.id);
    localStorage.setItem(ACTIVE_COMPANY_KEY, newCompany.id.toString());
    setShowModal(null);
    setFormData({});
    setView('dashboard');
    notify(`Company "${newCompany.name}" created`);
  };

  const handleUpdateCompany = () => {
    setData(prev => ({
      ...prev,
      companies: prev.companies.map(c => c.id === formData.id ? { ...c, ...formData } : c)
    }));
    setShowModal(null);
    notify("Company updated");
  };

  const handleDeleteCompany = (id: number) => {
    if (!window.confirm("Delete this company and all its data?")) return;
    setData(prev => ({ ...prev, companies: prev.companies.filter(c => c.id !== id) }));
    if (selectedCompanyId === id) {
      setSelectedCompanyId(null);
      setView('companies');
    }
    notify("Company deleted", "error");
  };

  const handleCreateAccount = () => {
    if (!formData.name || !formData.type) return notify("Missing required fields", "error");
    const newAccount: Account = {
      id: getNextId(),
      name: formData.name,
      code: formData.code || "",
      type: formData.type,
      description: formData.description || "",
      openingBalance: parseFloat(formData.openingBalance) || 0,
      entries: [],
      createdAt: new Date().toISOString()
    };
    setData(prev => ({
      ...prev,
      companies: prev.companies.map(c => 
        c.id === selectedCompanyId ? { ...c, accounts: [...c.accounts, newAccount] } : c
      )
    }));
    
    if (previousModal === 'new_entry' || previousModal === 'edit_entry') {
      const field = formData.accountSourceField; // We need to track which select triggered this
      setFormData({ ...formData, [field]: newAccount.id.toString() });
      setShowModal(previousModal);
      setPreviousModal(null);
    } else {
      setShowModal(null);
      setFormData({});
    }
    notify(`Account "${newAccount.name}" added`);
  };

  const handleUpdateAccount = () => {
    setData(prev => ({
      ...prev,
      companies: prev.companies.map(c => 
        c.id === selectedCompanyId ? {
          ...c,
          accounts: c.accounts.map(a => a.id === formData.id ? { ...a, ...formData } : a)
        } : c
      )
    }));
    setShowModal(null);
    notify("Account updated");
  };

  const handleDeleteAccount = (id: number) => {
    if (!window.confirm("Delete this account?")) return;
    setData(prev => ({
      ...prev,
      companies: prev.companies.map(c => 
        c.id === selectedCompanyId ? { ...c, accounts: c.accounts.filter(a => a.id !== id) } : c
      )
    }));
    notify("Account deleted", "error");
  };

  const handleSaveEntry = () => {
    const { debitAccountId, creditAccountId, amount, date, description, reference, transactionId } = formData;
    if (!debitAccountId || !creditAccountId || !amount || !date) return notify("Missing fields", "error");
    if (debitAccountId === creditAccountId) return notify("Debit/Credit must differ", "error");
    
    const amt = parseFloat(amount);
    const txnId = transactionId || getNextId();
    
    const debitEntry: Entry = {
      id: getNextId(),
      transactionId: txnId,
      date,
      description: description || "",
      type: 'debit',
      amount: amt,
      reference: reference || "",
      contraAccountId: parseInt(creditAccountId)
    };
    
    const creditEntry: Entry = {
      id: getNextId(),
      transactionId: txnId,
      date,
      description: description || "",
      type: 'credit',
      amount: amt,
      reference: reference || "",
      contraAccountId: parseInt(debitAccountId)
    };

    setData(prev => ({
      ...prev,
      companies: prev.companies.map(c => 
        c.id === selectedCompanyId ? {
          ...c,
          accounts: c.accounts.map(a => {
            // Remove old leg if updating (for simple replacement logic)
            const cleanEntries = transactionId ? a.entries.filter(e => e.transactionId !== transactionId) : a.entries;
            if (a.id === parseInt(debitAccountId)) return { ...a, entries: [...cleanEntries, debitEntry] };
            if (a.id === parseInt(creditAccountId)) return { ...a, entries: [...cleanEntries, creditEntry] };
            return { ...a, entries: cleanEntries };
          })
        } : c
      )
    }));
    setShowModal(null);
    setFormData({});
    notify(transactionId ? "Transaction updated" : "Entry recorded");
  };

  const handleDeleteTransaction = (txnId: number) => {
    if (!window.confirm("Delete entire transaction?")) return;
    setData(prev => ({
      ...prev,
      companies: prev.companies.map(c => 
        c.id === selectedCompanyId ? {
          ...c,
          accounts: c.accounts.map(a => ({
            ...a,
            entries: a.entries.filter(e => e.transactionId !== txnId)
          }))
        } : c
      )
    }));
    notify("Transaction deleted", "error");
  };

  // --- Calculations ---
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeCompany?.currency || 'PKR'
    }).format(val);
  };

  const getAccountBalance = useCallback((acc: Account, asOfDate?: string, startDate?: string) => {
    const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type);
    const isIS = typeInfo?.category === 'Income Statement';
    
    const opening = isIS ? 0 : (acc.openingBalance || 0);

    return acc.entries.reduce((sum, e) => {
      if (asOfDate && e.date > asOfDate) return sum;
      if (isIS && startDate && e.date < startDate) return sum;
      
      const type = e.type === typeInfo?.normal ? 1 : -1;
      return sum + (e.amount * type);
    }, opening);
  }, []);

  const getSortedEntriesWithRunningBalance = useCallback((acc: Account, start?: string, end?: string) => {
    const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type);
    const sorted = [...acc.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id - b.id);
    
    let currentBalance = acc.openingBalance;
    const withRunning = sorted.map(e => {
        const type = e.type === typeInfo?.normal ? 1 : -1;
        currentBalance += (e.amount * type);
        return { ...e, runningBalance: currentBalance };
    });

    return withRunning.filter(e => {
        if (start && e.date < start) return false;
        if (end && e.date > end) return false;
        return true;
    }).reverse();
  }, []);

  const exportToPDF = useCallback((title: string, headers: string[], rows: any[][], summary?: { label: string, value: string }[]) => {
    const doc = new jsPDF();
    const period = rangeType === 'all' ? 'All Time' : `${activeRange.start} to ${activeRange.end}`;
    const margin = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header Section
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text(activeCompany?.name || 'LedgerPro', margin, 15);
    
    doc.setFontSize(14);
    doc.setTextColor(80);
    doc.text(title, margin, 24);
    
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Period: ${period}`, margin, 31);
    
    const totalPagesExp = "{total_pages_count_string}";
    doc.text(`Total Pages: ${totalPagesExp}`, margin, 36);
    
    doc.text(`Run Date: ${new Date().toLocaleString()}`, margin, 41);

    // Vertical Summary on the Right
    let summaryEndY = 45;
    if (summary && summary.length > 0) {
      doc.setFontSize(9);
      const startX = pageWidth - 70;
      summary.forEach((item, idx) => {
        const y = 15 + idx * 6;
        doc.setTextColor(100);
        doc.text(item.label + ":", startX, y);
        doc.setTextColor(40);
        doc.text(item.value, startX + 35, y, { align: 'left' });
        summaryEndY = Math.max(summaryEndY, y + 5);
      });
    }

    const startTableY = Math.max(50, summaryEndY);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: startTableY,
      styles: { fontSize: 8, cellPadding: 2, textColor: [40, 40, 40] },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [230, 235, 245] },
      margin: { top: margin, left: margin, right: margin, bottom: 15 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const text = data.cell.text[0];
          // Color coding for transactions
          if (text.includes('(+)')) {
            data.cell.styles.textColor = [16, 185, 129]; // Success Green
          } else if (text.includes('(-)')) {
            data.cell.styles.textColor = [239, 68, 68]; // Danger Red
          }
        }
      },
      didDrawPage: (data) => {
        let str = "Page " + doc.getNumberOfPages();
        if (typeof doc.putTotalPages === 'function') {
          str += " of " + totalPagesExp;
        }
        doc.setFontSize(8);
        doc.setTextColor(150);
        const pageSize = doc.internal.pageSize;
        const width = pageSize.width ? pageSize.width : pageSize.getWidth();
        const height = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(str, width / 2, height - 7, { align: 'center' });
      }
    });

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  }, [activeCompany, activeRange, rangeType]);

  // --- Views ---
  const renderCompanies = () => (
    <div className="space-y-4 pt-16 pb-20 px-4 max-w-2xl mx-auto animate-slide-up">
      <div className="flex flex-col gap-1 mb-4">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-bold">Workspace</span>
        <h2 className="text-2xl font-bold text-[var(--text-bright)]">Businesses</h2>
      </div>

      <div className="space-y-3">
        {data.companies.map(c => (
          <motion.div 
            key={c.id} 
            layoutId={`company-${c.id}`}
            onClick={() => { setSelectedCompanyId(c.id); setView('accounts'); localStorage.setItem(ACTIVE_COMPANY_KEY, c.id.toString()); }}
            className="p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] flex items-center justify-between group cursor-pointer active:scale-[0.98] transition-all shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white shadow-lg">
                <Building2 size={20} />
              </div>
              <div>
                <h4 className="font-bold text-base text-[var(--text-bright)]">{c.name}</h4>
                <p className="text-[10px] text-[var(--muted)] uppercase tracking-tight">{c.industry || 'General Business'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <EllipsisMenu options={[
                { label: 'Edit Business', icon: Edit3, onClick: () => { setFormData(c); setShowModal('edit_company'); } },
                { label: 'Delete', icon: Trash2, onClick: () => handleDeleteCompany(c.id), danger: true }
              ]} />
              <ChevronRight className="text-[var(--muted)] group-hover:translate-x-1 transition-transform" size={20} />
            </div>
          </motion.div>
        ))}
        {data.companies.length === 0 && (
          <div className="py-20 text-center space-y-6">
            <div className="w-20 h-20 bg-[#1C1C1F] border border-[#27272A] rounded-full mx-auto flex items-center justify-center text-[var(--muted)] text-3xl">
              <Building2 size={40} />
            </div>
            <div className="space-y-2">
               <p className="text-[var(--text-bright)] font-bold">No businesses found</p>
               <p className="text-sm text-[var(--muted)]">Create your first company to start bookkeeping.</p>
            </div>
            <button onClick={() => setShowModal('new_company')} className="btn-primary mx-auto">
               <Plus size={20} /> Add Business
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (!activeCompany) return null;

    // Get latest 10 transactions across all accounts
    const allEntries: (Entry & { accountName: string; accountId: number })[] = [];
    activeCompany.accounts.forEach(acc => {
      acc.entries.forEach(e => {
        allEntries.push({ ...e, accountName: acc.name, accountId: acc.id });
      });
    });

    const latestEntries = [...allEntries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id)
      .slice(0, 10);

    return (
      <div className="pt-14 pb-20 px-4 max-w-2xl mx-auto space-y-3 animate-slide-up">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col gap-0.1">
             <span className="text-[8px] uppercase tracking-widest text-[var(--muted)] font-black">Overview</span>
             <h2 className="text-lg font-bold text-[var(--text-bright)]">{activeCompany.name}</h2>
          </div>
          <DateFilter range={rangeType} setRange={setRangeType} custom={customRange} setCustom={setCustomRange} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm">
            <p className="text-[8px] font-black text-[var(--muted)] uppercase">Opening</p>
            <h3 className="text-[11px] font-bold text-[var(--text-bright)] mt-0.5 truncate">
              {formatCurrency(activeCompany.accounts.reduce((s, a) => s + getAccountBalance(a, new Date(new Date(activeRange.start).getTime() - 86400000).toISOString().split('T')[0]), 0))}
            </h3>
          </div>
          <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm">
            <p className="text-[8px] font-black text-teal-400 uppercase">Debit (+)</p>
            <h3 className="text-[11px] font-bold text-[var(--text-bright)] mt-0.5 truncate">
              {formatCurrency(activeCompany.accounts.reduce((sum, a) => sum + a.entries.filter(e => e.date >= activeRange.start && e.date <= activeRange.end && e.type === 'debit').reduce((s, e) => s + e.amount, 0), 0))}
            </h3>
          </div>
          <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm">
            <p className="text-[8px] font-black text-orange-400 uppercase">Credit (-)</p>
            <h3 className="text-[11px] font-bold text-[var(--text-bright)] mt-0.5 truncate">
              {formatCurrency(activeCompany.accounts.reduce((sum, a) => sum + a.entries.filter(e => e.date >= activeRange.start && e.date <= activeRange.end && e.type === 'credit').reduce((s, e) => s + e.amount, 0), 0))}
            </h3>
          </div>
          <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-blue-500/20 bg-blue-500/5 shadow-sm">
            <p className="text-[8px] font-black text-blue-400 uppercase">Closing</p>
            <h3 className="text-[11px] font-black text-[var(--text-bright)] mt-0.5 truncate">
              {formatCurrency(activeCompany.accounts.reduce((s, a) => s + getAccountBalance(a, activeRange.end), 0))}
            </h3>
          </div>
        </div>

        <div className="space-y-2.5 mt-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[9px] font-black text-[var(--muted)] uppercase tracking-wider">Latest Transactions</h3>
            <button onClick={() => setView('accounts')} className="text-[9px] font-bold text-blue-400 hover:underline">View Accounts</button>
          </div>
          
          <div className="space-y-2">
            {latestEntries.map(entry => {
              const contra = activeCompany.accounts.find(a => a.id === entry.contraAccountId);
              return (
                <div 
                  key={`${entry.accountId}-${entry.id}`} 
                  className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)] flex justify-between items-center shadow-sm"
                  onClick={() => { setSelectedAccountId(entry.accountId); setView('journal'); }}
                >
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[var(--text-bright)]">{entry.description || 'General Entry'}</p>
                    <p className="text-[9px] text-[var(--muted)] font-black uppercase mt-0.5">
                      {entry.accountName} <span className="opacity-40">↔</span> {contra?.name || 'External'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black ${entry.type === 'debit' ? 'text-teal-400' : 'text-orange-400'}`}>
                      {entry.type === 'debit' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </p>
                    <p className="text-[8px] text-[var(--muted)] font-black mt-0.5">{entry.date}</p>
                  </div>
                </div>
              );
            })}
            {latestEntries.length === 0 && (
              <div className="py-12 bg-[var(--surface)] rounded-2xl border border-[var(--border)] border-dashed text-center">
                <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-widest">No entries yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAccounts = () => {
    const filtered = activeCompany?.accounts
      .filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.code.includes(searchTerm)
      )
      .sort((a, b) => a.name.localeCompare(b.name)) || [];

    return (
      <div className="pt-14 pb-20 px-4 max-w-2xl mx-auto space-y-3 animate-slide-up">
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] uppercase tracking-widest text-[var(--muted)] font-black">Directory</span>
          <h2 className="text-lg font-bold text-[var(--text-bright)]">Chart of Accounts</h2>
        </div>

        <div className="flex gap-2 h-10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
            <input 
              type="text" 
              placeholder="Search accounts..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-9 pr-4 text-xs font-medium outline-none focus:border-blue-500/50 transition-all text-[var(--text-bright)]"
            />
          </div>
          <button 
            onClick={() => { setFormData({}); setShowModal('new_account'); }}
            className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all shrink-0"
            title="Add Account"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-2">
          {filtered.map(acc => {
            const balance = getAccountBalance(acc, activeRange.end);
            return (
              <div 
                key={acc.id}
                onClick={() => { setSelectedAccountId(acc.id); setView('journal'); }}
                className="p-3.5 bg-[var(--surface)] rounded-xl border border-[var(--border)] flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer shadow-sm"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[var(--text-bright)]">{acc.name}</span>
                  <span className="text-[9px] text-[var(--muted)] font-black uppercase tracking-tight">{acc.code} • {acc.type}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${balance >= 0 ? 'text-[var(--text-bright)]' : 'text-danger'}`}>
                      {formatCurrency(balance)}
                    </p>
                  </div>
                  <EllipsisMenu options={[
                    { label: 'View Journal', icon: FileText, onClick: () => { setSelectedAccountId(acc.id); setView('journal'); } },
                    { label: 'Edit Account', icon: Edit3, onClick: () => { setFormData(acc); setShowModal('edit_account'); } },
                    { label: 'Delete', icon: Trash2, onClick: () => handleDeleteAccount(acc.id), danger: true }
                  ]} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderJournal = () => {
    if (!activeAccount) return null;
    
    const entriesWithRB = getSortedEntriesWithRunningBalance(activeAccount, activeRange.start, activeRange.end);
    
    const filteredEntries = entriesWithRB.filter(e => {
      const q = journalSearch.toLowerCase();
      const contra = activeCompany?.accounts.find(a => a.id === e.contraAccountId);
      return (
        e.description.toLowerCase().includes(q) ||
        e.reference.toLowerCase().includes(q) ||
        e.amount.toString().includes(q) ||
        e.date.includes(q) ||
        contra?.name.toLowerCase().includes(q) ||
        e.transactionId.toString().includes(q)
      );
    });

    const handleExportJournal = () => {
      const opening = getAccountBalance(activeAccount, new Date(new Date(activeRange.start).getTime() - 86400000).toISOString().split('T')[0]);
      const closing = getAccountBalance(activeAccount, activeRange.end);
      const totalDebit = filteredEntries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0);
      const totalCredit = filteredEntries.reduce((s, e) => e.type === 'credit' ? s + e.amount : s, 0);

      // Sort for export as well
      const sortedForExport = [...filteredEntries].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return journalSort === 'desc' ? timeB - timeA : timeA - timeB;
      });

      const rows = sortedForExport.map(e => {
          const contra = activeCompany?.accounts.find(a => a.id === e.contraAccountId);
          const contraStr = contra ? `${contra.name} (${contra.code})` : 'External';
          return [
              `${e.date}\n${e.description}`,
              contraStr,
              e.type === 'debit' ? `(+) ${formatCurrency(e.amount)}` : '-',
              e.type === 'credit' ? `(-) ${formatCurrency(e.amount)}` : '-',
              formatCurrency(e.runningBalance)
          ];
      });

      const summary = [
        { label: "Opening Bal", value: formatCurrency(opening) },
        { label: "Total Dr", value: formatCurrency(totalDebit) },
        { label: "Total Cr", value: formatCurrency(totalCredit) },
        { label: "Closing Bal", value: formatCurrency(closing) }
      ];

      exportToPDF(`Ledger: ${activeAccount.name}`, ["Date Description", "Contra Account", "Debit (+)", "Credit (-)", "Balance"], rows, summary);
    };

    const opening = getAccountBalance(activeAccount, new Date(new Date(activeRange.start).getTime() - 86400000).toISOString().split('T')[0]);
    const closing = getAccountBalance(activeAccount, activeRange.end);
    const totalDebit = filteredEntries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0);
    const totalCredit = filteredEntries.reduce((s, e) => e.type === 'credit' ? s + e.amount : s, 0);

    const sortedEntries = [...filteredEntries].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return journalSort === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return (
      <div className="pt-16 pb-20 px-4 max-w-4xl mx-auto space-y-4 animate-slide-up">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setView('accounts')} className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--text)]">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-bright)]">{activeAccount.name}</h2>
                <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-tighter">Ledger • {activeAccount.code}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setJournalSort(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--muted)] hover:text-blue-400 transition-colors"
                title={`Sort: ${journalSort === 'desc' ? 'Newest' : 'Oldest'}`}
              >
                {journalSort === 'desc' ? <ArrowDownNarrowWide size={18} /> : <ArrowUpNarrowWide size={18} />}
              </button>
              <button 
                onClick={handleExportJournal}
                className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--muted)] hover:text-blue-400 transition-colors"
                title="Export PDF"
              >
                <FileDown size={18} />
              </button>
              <button 
                onClick={() => { 
                  setFormData({ 
                    date: new Date().toISOString().split('T')[0],
                    debitAccountId: activeAccount.id.toString()
                  }); 
                  setShowModal('new_entry'); 
                }}
                className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 items-center h-10">
            <div className="relative flex-1 h-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
              <input 
                type="text" 
                placeholder="Search txns..." 
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                className="w-full h-full bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-9 pr-4 text-xs font-medium outline-none focus:border-blue-500/50 transition-all text-[var(--text-bright)]"
              />
            </div>
            <DateFilter range={rangeType} setRange={setRangeType} custom={customRange} setCustom={setCustomRange} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-[var(--muted)] uppercase">Opening</p>
            <p className="text-xs font-bold text-[var(--text-bright)] truncate">{formatCurrency(opening)}</p>
          </div>
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-teal-400 uppercase">Debit (+)</p>
            <p className="text-xs font-bold text-[var(--text-bright)] truncate">{formatCurrency(totalDebit)}</p>
          </div>
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-orange-400 uppercase">Credit (-)</p>
            <p className="text-xs font-bold text-[var(--text-bright)] truncate">{formatCurrency(totalCredit)}</p>
          </div>
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl border-blue-500/20 bg-blue-500/5 shadow-sm">
            <p className="text-[8px] font-black text-blue-400 uppercase">Closing</p>
            <p className="text-xs font-black text-[var(--text-bright)] truncate">{formatCurrency(closing)}</p>
          </div>
        </div>

        <div className="space-y-3">
          {sortedEntries.map(entry => {
            const contra = activeCompany?.accounts.find(a => a.id === entry.contraAccountId);
            return (
              <div 
                key={entry.id} 
                className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)] relative group active:scale-[0.99] transition-all"
                onClick={() => {
                  const debitAccId = entry.type === 'debit' ? activeAccount.id : contra?.id;
                  const creditAccId = entry.type === 'credit' ? activeAccount.id : contra?.id;
                  setFormData({
                    ...entry,
                    debitAccountId: debitAccId?.toString(),
                    creditAccountId: creditAccId?.toString()
                  });
                  setShowModal('edit_entry');
                }}
              >
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-[var(--muted)] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--border)] uppercase">{entry.date}</span>
                    {entry.reference && <span className="text-[9px] font-black text-blue-400 border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 rounded uppercase">{entry.reference}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-[var(--muted)] tracking-tighter uppercase">Balance: {formatCurrency(entry.runningBalance)}</span>
                    <EllipsisMenu options={[
                      { label: 'Edit Transaction', icon: Edit3, onClick: () => {
                        const debitAccId = entry.type === 'debit' ? activeAccount.id : contra?.id;
                        const creditAccId = entry.type === 'credit' ? activeAccount.id : contra?.id;
                        setFormData({
                          ...entry,
                          debitAccountId: debitAccId?.toString(),
                          creditAccountId: creditAccId?.toString()
                        });
                        setShowModal('edit_entry');
                      }},
                      { label: 'Delete Transaction', icon: Trash2, onClick: () => handleDeleteTransaction(entry.transactionId), danger: true }
                    ]} />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-semibold text-[var(--text-bright)] line-clamp-1">{entry.description}</p>
                    <p className="text-[10px] text-[var(--muted)] font-black uppercase flex items-center gap-1.5 mt-0.5">
                      <span className="opacity-60">Contra:</span>
                      <span className="text-blue-400/80">{contra?.name || 'External'}</span>
                      <span className="text-[9px] opacity-40">#{entry.transactionId}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${entry.type === 'debit' ? 'text-teal-400' : 'text-orange-400'}`}>
                      {entry.type === 'debit' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredEntries.length === 0 && (
              <div className="py-16 text-center text-xs font-bold text-[var(--muted)] uppercase tracking-widest">No transactions for this period.</div>
            )}
        </div>
      </div>
    );
  };

  // --- Modals ---
  const renderModals = () => {
    return (
      <AnimatePresence>
        {showModal === 'new_company' && (
          <Modal title="New Business" onConfirm={handleCreateCompany} confirmText="Get Started">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--muted)] uppercase">Company Name</label>
                <input 
                  type="text" 
                  value={formData.name || ""} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary)]"
                  placeholder="e.g. Atlas Corp"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--muted)] uppercase">Industry</label>
                <input 
                  type="text" 
                  value={formData.industry || ""} 
                  onChange={e => setFormData({...formData, industry: e.target.value})}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary)]"
                  placeholder="e.g. Retail"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--muted)] uppercase">Currency Code</label>
                <input 
                  type="text" 
                  value={formData.currency || "PKR"} 
                  onChange={e => setFormData({...formData, currency: e.target.value})}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          </Modal>
        )}

        {showModal === 'edit_company' && (
          <Modal title="Edit Business" onConfirm={handleUpdateCompany} onClose={() => setShowModal(null)}>
             <div className="space-y-4">
              <input 
                type="text" 
                value={formData.name || ""} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary)]"
                placeholder="Company Name"
              />
              <input 
                type="text" 
                value={formData.industry || ""} 
                onChange={e => setFormData({...formData, industry: e.target.value})}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary)]"
                placeholder="Industry"
              />
            </div>
          </Modal>
        )}

        {(showModal === 'new_account' || showModal === 'edit_account') && (
          <Modal title={showModal === 'new_account' ? "New Account" : "Edit Account"} onConfirm={showModal === 'new_account' ? handleCreateAccount : handleUpdateAccount} onClose={() => setShowModal(null)}>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_TYPES.map(t => (
                  <button 
                    key={t.value}
                    onClick={() => setFormData({ ...formData, type: t.value })}
                    className={`px-2 py-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${formData.type === t.value ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Account Name" 
                value={formData.name || ""} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary)]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="text" 
                  placeholder="Code (e.g. 1001)" 
                  value={formData.code || ""} 
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary)]"
                />
                <input 
                  type="number" 
                  placeholder="Opening Bal" 
                  value={formData.openingBalance || ""} 
                  onChange={e => setFormData({...formData, openingBalance: e.target.value})}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary)]"
                />
              </div>
              <textarea 
                placeholder="Description" 
                value={formData.description || ""} 
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-[var(--primary)] h-20"
              />
            </div>
          </Modal>
        )}

        {(showModal === 'new_entry' || showModal === 'edit_entry') && (
           <Modal title={formData.transactionId ? "Edit Entry" : "Double Entry Ledger"} onConfirm={handleSaveEntry} onClose={() => setShowModal(null)}>
              <div className="space-y-4">
                <div className="space-y-1.5 focus-within:z-10">
                  <label className="text-[10px] font-black text-[var(--muted)] uppercase">Transaction Date</label>
                  <input type="date" value={formData.date || ""} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SearchableSelect 
                    label="Debit (Increase Asset/Exp)"
                    placeholder="Select Account"
                    value={formData.debitAccountId}
                    colorClass="text-teal-400"
                    options={activeCompany?.accounts.filter(a => a.id.toString() !== formData.creditAccountId).map(a => ({ value: a.id.toString(), label: a.name })) || []}
                    onChange={(val: string) => setFormData({ ...formData, debitAccountId: val })}
                    onAddClick={() => { setPreviousModal(showModal); setFormData({...formData, accountSourceField: 'debitAccountId'}); setShowModal('new_account'); }}
                  />
                  <SearchableSelect 
                    label="Credit (Dec Asset / Inc Liab)"
                    placeholder="Select Account"
                    value={formData.creditAccountId}
                    colorClass="text-orange-400"
                    options={activeCompany?.accounts.filter(a => a.id.toString() !== formData.debitAccountId).map(a => ({ value: a.id.toString(), label: a.name })) || []}
                    onChange={(val: string) => setFormData({ ...formData, creditAccountId: val })}
                    onAddClick={() => { setPreviousModal(showModal); setFormData({...formData, accountSourceField: 'creditAccountId'}); setShowModal('new_account'); }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[var(--muted)] uppercase">Amount</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={formData.amount || ""} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-xl font-black text-[var(--text-bright)] outline-none focus:border-blue-500/50" 
                  />
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-[var(--muted)] uppercase">Notes / Reference</label>
                   <input type="text" placeholder="Description" value={formData.description || ""} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50" />
                   <input type="text" placeholder="Reference #" value={formData.reference || ""} onChange={e => setFormData({...formData, reference: e.target.value})} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 mt-2 outline-none focus:border-blue-500/50" />
                </div>
              </div>
           </Modal>
        )}

        {showModal === 'settings' && (
          <Modal title="Settings" confirmText="Done" onConfirm={() => setShowModal(null)} onClose={() => setShowModal(null)}>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--primary)]/10 text-[var(--primary)] rounded-lg">
                    {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                  <span className="font-bold">Dark Mode</span>
                </div>
                <button onClick={toggleTheme} className={`w-12 h-6 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-[var(--primary)]' : 'bg-gray-400'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${theme === 'dark' ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black text-[var(--muted)] uppercase px-2">Data Sync</h4>
                <div className="flex gap-2">
                   <button onClick={exportData} className="flex-1 btn-secondary text-sm">
                      <Download size={16} /> Export
                   </button>
                   <label className="flex-1 btn-secondary text-sm cursor-pointer">
                      <Upload size={16} /> Import
                      <input type="file" className="hidden" accept=".json" onChange={importData} />
                   </label>
                </div>
              </div>

              <div className="space-y-3">
                 <h4 className="text-xs font-black text-[var(--muted)] uppercase px-2">Active Company</h4>
                 <select 
                   value={selectedCompanyId || ""} 
                   onChange={(e) => { setSelectedCompanyId(parseInt(e.target.value)); localStorage.setItem(ACTIVE_COMPANY_KEY, e.target.value); }}
                   className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 font-bold"
                 >
                   <option value="">Switch Company...</option>
                   {data.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
                 <button onClick={() => { setView('companies'); setShowModal(null); }} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-[var(--primary)] py-2">
                   <Building2 size={16} /> Manage All Businesses
                 </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    );
  };

  const renderBalanceSheet = () => {
    if (!activeCompany) return null;
    
    const accountsByType = (type: AccountType) => activeCompany.accounts.filter(a => a.type === type);
    const totalByType = (type: AccountType) => accountsByType(type).reduce((s, a) => s + getAccountBalance(a, activeRange.end, activeRange.start), 0);
    
    const assets = accountsByType('asset');
    const liabilities = accountsByType('liability');
    const equity = accountsByType('equity');
    
    const totalAssets = totalByType('asset');
    const totalLiabilities = totalByType('liability');
    const totalEquity = totalByType('equity');
    const totalRev = totalByType('revenue');
    const totalExp = totalByType('expense');
    const netIncome = totalRev - totalExp;
    
    const bsBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 0.01;

    const handleExportBS = () => {
      const rows: any[][] = [];
      const addSection = (title: string, accounts: Account[], total: number) => {
        rows.push([{ content: title, colSpan: 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);
        accounts.forEach(a => rows.push([a.name, formatCurrency(getAccountBalance(a, activeRange.end, activeRange.start))]));
        rows.push([{ content: `Total ${title}`, styles: { fontStyle: 'bold' } }, { content: formatCurrency(total), styles: { fontStyle: 'bold' } }]);
      };

      addSection('ASSETS', assets, totalAssets);
      addSection('LIABILITIES', liabilities, totalLiabilities);
      addSection('EQUITY', equity, totalEquity);
      
      rows.push([{ content: 'Net Income (for period)', styles: { fontStyle: 'bold' } }, { content: formatCurrency(netIncome), styles: { fontStyle: 'bold' } }]);
      rows.push([
        { content: 'TOTAL LIABILITIES & EQUITY', styles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' } }, 
        { content: formatCurrency(totalLiabilities + totalEquity + netIncome), styles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' } }
      ]);

      const summary = [
        { label: "Total Assets", value: formatCurrency(totalAssets) },
        { label: "Total Liab + Eq", value: formatCurrency(totalLiabilities + totalEquity + netIncome) },
        { label: "Net Income", value: formatCurrency(netIncome) },
        { label: "Status", value: bsBalanced ? "Balanced" : "Unbalanced" }
      ];

      exportToPDF(`Balance Sheet: ${activeCompany.name}`, ["Account", "Balance"], rows, summary);
    };

    return (
      <div className="pt-16 pb-20 px-4 max-w-2xl mx-auto space-y-4 animate-slide-up">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-[var(--text-bright)]">Financial Summary</h2>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleExportBS}
                className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--muted)] hover:text-blue-400 transition-colors"
                title="Export PDF"
              >
                <FileDown size={18} />
              </button>
              <DateFilter range={rangeType} setRange={setRangeType} custom={customRange} setCustom={setCustomRange} />
            </div>
          </div>
          <p className="text-[10px] text-[var(--muted)] uppercase tracking-widest font-black">
            {rangeType === 'all' ? 'All Time' : `As of ${activeRange.end}`}
          </p>
        </div>

        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-lg ${bsBalanced ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-red-500/10 border-red-500/30 text-danger'}`}>
          <div className="flex items-center gap-3">
            {bsBalanced ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <div>
              <p className="text-[10px] font-black uppercase tracking-tighter">{bsBalanced ? 'Balanced' : 'Unbalanced'}</p>
              <p className="text-[9px] opacity-80">{bsBalanced ? 'Assets = Liab + Equity' : `Diff: ${formatCurrency(totalAssets - (totalLiabilities + totalEquity + netIncome))}`}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-bold uppercase opacity-60">Total Assets</p>
            <p className="text-lg font-black">{formatCurrency(totalAssets)}</p>
          </div>
        </div>

        {/* Assets */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] uppercase tracking-widest text-[var(--muted)] font-black">Assets</span>
            <span className="text-xs font-bold text-teal-400">{formatCurrency(totalAssets)}</span>
          </div>
          <div className="space-y-1.5">
            {assets.map(a => (
              <div key={a.id} className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)] flex justify-between items-center shadow-sm">
                <span className="text-xs font-semibold text-[var(--text-bright)]">{a.name}</span>
                <span className="text-xs font-bold text-[var(--text-bright)]">{formatCurrency(getAccountBalance(a, activeRange.end))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Liabilities */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] uppercase tracking-widest text-[var(--muted)] font-black">Liabilities</span>
            <span className="text-xs font-bold text-orange-400">{formatCurrency(totalLiabilities)}</span>
          </div>
          <div className="space-y-1.5">
            {liabilities.map(a => (
              <div key={a.id} className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)] flex justify-between items-center shadow-sm">
                <span className="text-xs font-semibold text-[var(--text-bright)]">{a.name}</span>
                <span className="text-xs font-bold text-[var(--text-bright)]">{formatCurrency(getAccountBalance(a, activeRange.end))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Equity */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-[9px] uppercase tracking-widest text-[var(--muted)] font-black">Equity</span>
            <span className="text-xs font-bold text-blue-400">{formatCurrency(totalEquity + netIncome)}</span>
          </div>
          <div className="p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)] space-y-3 shadow-sm">
             <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[var(--text-bright)]">Opening Equity</span>
                <span className="text-xs font-bold text-[var(--text-bright)]">{formatCurrency(totalEquity)}</span>
             </div>
             <div className="flex justify-between items-center pt-3 border-t border-[var(--border)]">
                <span className="text-xs font-semibold text-blue-400">Net Income (Period)</span>
                <span className={`text-xs font-bold ${netIncome >= 0 ? 'text-teal-400' : 'text-danger'}`}>{formatCurrency(netIncome)}</span>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const exportData = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledgerpro_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Export complete");
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.companies && imported.nextId) {
          setData(imported);
          notify("Data imported successfully");
        } else {
          notify("Invalid backup format", "error");
        }
      } catch {
        notify("Failed to parse file", "error");
      }
    };
    reader.readAsText(file);
  };
  if (!isLoaded) return <div className="h-screen flex items-center justify-center bg-[var(--bg)] font-black text-xl animate-pulse">LEDGERPRO</div>;

  return (
    <div className="relative min-h-screen pb-20 native-scroll">
      {/* Dynamic Header */}
      <header className="glass-header flex items-center justify-between !mx-0 !rounded-none !top-0 !bg-[var(--surface)]/80 backdrop-blur-xl border-b border-[var(--border)] px-6 h-14 sticky z-[60]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white shadow-lg">
            <TrendingUp size={18} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-[var(--text-bright)] leading-none">LedgerPro</h1>
            <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-tight mt-0.5">Enterprise v2.0</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {activeCompany && (
            <button 
              onClick={() => { setFormData({ date: new Date().toISOString().split('T')[0] }); setShowModal('new_entry'); }}
              className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-500/20 transition-all"
            >
              <Plus size={16} />
            </button>
          )}
          <button onClick={() => setShowModal('settings')} className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--card)] transition-colors text-[var(--muted)]">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-10">
        {view === 'companies' && renderCompanies()}
        {view === 'dashboard' && renderDashboard()}
        {view === 'accounts' && renderAccounts()}
        {view === 'journal' && renderJournal()}
        {view === 'balanceSheet' && renderBalanceSheet()}
      </main>

      {/* Mobile Navigation */}
      {activeCompany && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card)]/90 backdrop-blur-xl border-t border-[var(--border)] pb-safe shadow-2xl">
          <div className="flex justify-around items-center h-16 px-4 max-w-lg mx-auto relative">
             <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 transition-all ${view === 'dashboard' ? 'text-blue-500 scale-105' : 'text-[var(--muted)]'}`}>
                <LayoutDashboard size={20} />
                <span className="text-[8px] font-black uppercase tracking-tighter">Dash</span>
             </button>
             
             <button onClick={() => setView('accounts')} className={`flex flex-col items-center gap-1 transition-all ${view === 'accounts' ? 'text-blue-500 scale-105' : 'text-[var(--muted)]'}`}>
                <FolderOpen size={20} />
                <span className="text-[8px] font-black uppercase tracking-tighter">Accounts</span>
             </button>
             
             {/* Center Plus Button */}
             <div className="relative -top-4">
                <button 
                  onClick={() => { setFormData({ date: new Date().toISOString().split('T')[0] }); setShowModal('new_entry'); }}
                  className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/40 relative z-10 active:scale-90 transition-transform"
                >
                  <Plus size={24} />
                </button>
                <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 -z-10" />
             </div>

             <button onClick={() => setView('balanceSheet')} className={`flex flex-col items-center gap-1 transition-all ${view === 'balanceSheet' ? 'text-blue-500 scale-105' : 'text-[var(--muted)]'}`}>
                <Scale size={20} />
                <span className="text-[8px] font-black uppercase tracking-tighter">Sheet</span>
             </button>
             <button onClick={() => setView('companies')} className={`flex flex-col items-center gap-1 transition-all ${view === 'companies' ? 'text-blue-500 scale-105' : 'text-[var(--muted)]'}`}>
                <Building2 size={20} />
                <span className="text-[8px] font-black uppercase tracking-tighter">Switch</span>
             </button>
          </div>
        </nav>
      )}

      {/* Modal Layers */}
      {renderModals()}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-24 left-4 right-4 z-[200] max-w-sm mx-auto p-4 rounded-2xl flex items-center gap-3 shadow-2xl ${toast.type === 'error' ? 'bg-red-500' : 'bg-teal-500'} text-white`}
          >
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span className="font-bold text-sm">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
