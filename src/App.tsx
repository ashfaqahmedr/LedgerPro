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
  ArrowUpDown,
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
  ArrowUpNarrowWide,
  Lock,
  Unlock,
  PieChart as PieChartIcon,
  BarChart3,
  Receipt,
  Users,
  Briefcase,
  DollarSign,
  TrendingDown,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

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
  pin?: string; // 4-digit PIN for security
  accounts: Account[];
  createdAt: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface AppData {
  companies: Company[];
  nextId: number;
  lastUsedDate?: string;
}

type ViewType = 'companies' | 'dashboard' | 'accounts' | 'journal' | 'reports';

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

const formatDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (str: string) => {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getDatesForRange = (range: DateRangeType, custom?: DateRange): DateRange => {
  const now = new Date();
  
  // Create a local midnight date
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
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
      d.setDate(d.getDate() - d.getDay()); // Sunday as start
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
const Modal = ({ title, children, onConfirm, confirmText = "Confirm", onClose, disabled, className }: any) => (
  <motion.div 
    key={`backdrop-${title}`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto native-scroll"
  >
    <motion.div 
      key={`modal-content-${title}`}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className={`w-full max-w-md bg-[var(--card)] rounded-3xl overflow-hidden shadow-2xl border border-[var(--border)] ${className || ""}`}
    >
      <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center">
        <h3 className="text-lg font-bold text-[var(--text-bright)]">{title}</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--text)]">
          <X size={18} />
        </button>
      </div>
      <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto native-scroll">
        {children}
      </div>
      <div className="p-3 bg-[var(--surface)] flex gap-3 border-t border-[var(--border)]">
        <button onClick={onClose} className="flex-1 px-4 py-1.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--muted)] hover:bg-[var(--card)] transition-colors">Cancel</button>
        <button 
          onClick={onConfirm} 
          disabled={disabled}
          className={`flex-1 px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20 ${disabled ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:bg-blue-500 active:scale-95'}`}
        >
          {confirmText}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const EllipsisMenu = ({ options }: { options: { label: string; icon: any; onClick: () => void; danger?: boolean }[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-[50]">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
        <MoreVertical size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-10 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-[110] overflow-hidden"
            >
              {options.map((opt, i) => (
                <div key={i}>
                  {i > 0 && <div className="border-t border-[var(--border)] opacity-40 mx-2" />}
                  <button 
                    onClick={(e) => { e.stopPropagation(); opt.onClick(); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/10 active:bg-blue-500/20 transition-all text-left ${opt.danger ? 'text-red-500 hover:bg-red-500/10 active:bg-red-500/20' : 'text-[var(--text-bright)]'}`}
                  >
                    <opt.icon size={16} className={`shrink-0 ${opt.danger ? 'text-red-500' : 'text-blue-500'}`} />
                    <span className="flex-1">{opt.label}</span>
                  </button>
                </div>
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
                    <label className="text-[8px] font-black text-[var(--muted)]">Start Date</label>
                    <input 
                      type="date" 
                      value={custom.start} 
                      onChange={e => setCustom({...custom, start: e.target.value})}
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-2 py-2 text-xs text-[var(--text-bright)] outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-[var(--muted)]">End Date</label>
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

const LockScreen = ({ company, onUnlock, onBack }: { company: Company, onUnlock: (pin: string) => void, onBack: () => void }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleKeypad = (val: string) => {
    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);
      if (newPin.length === 4) {
        if (newPin === company.pin) {
          onUnlock(newPin);
        } else {
          setError(true);
          setTimeout(() => { setPin(""); setError(false); }, 500);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--bg)] flex flex-col items-center justify-center p-6 bg-radial-gradient">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xs text-center space-y-8"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-xl shadow-blue-500/10 border border-blue-500/20">
            <Lock size={40} />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-[var(--text-bright)]">{company.name}</h2>
            <p className="text-[10px] font-black tracking-wider text-[var(--muted)]">Protected by PIN</p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          {[...Array(4)].map((_, i) => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full border-2 border-[var(--border)] transition-all duration-300 ${pin.length > i ? 'bg-blue-500 border-blue-500 scale-110 shadow-lg shadow-blue-500/30' : ''} ${error ? 'border-red-500 bg-red-500' : ''}`} 
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "C"].map((key, i) => (
            <button
               key={i}
               onClick={() => {
                 if (key === "C") setPin("");
                 else if (key) handleKeypad(key);
               }}
               className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black transition-all ${!key ? 'opacity-0' : 'bg-[var(--surface)] text-[var(--text-bright)] hover:bg-[var(--border)] active:scale-90 border border-[var(--border)]'}`}
            >
              {key}
            </button>
          ))}
        </div>

        <button
          onClick={onBack}
          className="text-xs font-bold text-[var(--muted)] hover:text-blue-500 mt-6 transition-colors flex items-center gap-1.5 mx-auto uppercase tracking-wider"
        >
          <ArrowLeft size={12} /> Switch Business / Exit
        </button>
      </motion.div>
    </div>
  );
};


const FinancialReports = ({ activeCompany, rangeType, setRangeType, customRange, setCustomRange, formatCurrency, activeRange, getAccountBalance, exportToPDF, notify }: any) => {
  const [activeTab, setActiveTab] = useState<'pl' | 'bs' | 'tb'>('pl');

  if (!activeCompany) return <div className="p-20 text-center animate-pulse">Loading company data...</div>;

  const accountsByType = (type: AccountType) => (activeCompany?.accounts || []).filter((a: any) => a.type === type);
  
  const tbData = useMemo(() => {
    return (activeCompany?.accounts || []).map((a: any) => {
      const balance = getAccountBalance(a, activeRange.end);
      const normal = ACCOUNT_TYPES.find(t => t.value === a.type)?.normal;
      return {
        ...a,
        balance,
        debit: normal === 'debit' ? (balance > 0 ? balance : 0) : (balance < 0 ? Math.abs(balance) : 0),
        credit: normal === 'credit' ? (balance > 0 ? balance : 0) : (balance < 0 ? Math.abs(balance) : 0)
      };
    });
  }, [activeCompany?.accounts, activeRange.end, getAccountBalance]);

  const plData = useMemo(() => {
    const revenues = accountsByType('revenue').map((a: any) => ({ name: a.name, amount: getAccountBalance(a, activeRange.end, activeRange.start) }));
    const expenses = accountsByType('expense').map((a: any) => ({ name: a.name, amount: getAccountBalance(a, activeRange.end, activeRange.start) }));
    const totalRev = revenues.reduce((s, a) => s + a.amount, 0);
    const totalExp = expenses.reduce((s, a) => s + a.amount, 0);
    return { revenues, expenses, totalRev, totalExp, netIncome: totalRev - totalExp };
  }, [activeCompany?.accounts, activeRange, getAccountBalance]);

  const cashFlowData = useMemo(() => {
    // Mock monthly data for chart for now, but we can derive from entries
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map(m => ({
      name: m,
      inflow: Math.random() * 5000 + 2000,
      outflow: Math.random() * 3000 + 1000
    }));
  }, []);

  const expenseDist = useMemo(() => {
    return plData.expenses
      .filter(e => e.amount > 0)
      .map(e => ({ name: e.name, value: e.amount }));
  }, [plData.expenses]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handleExportReport = () => {
    if (activeTab === 'pl') {
      const rows = [
        ['Operating Income', '', 'Total Revenue'],
        ...plData.revenues.map(r => [r.name, '', formatCurrency(r.amount)]),
        ['Gross Profit', '', formatCurrency(plData.totalRev)],
        ['', '', ''],
        ['Operating Expenses', '', 'Total Spent'],
        ...plData.expenses.map(e => [e.name, '', `(${formatCurrency(e.amount)})`]),
        ['Total Expenses', '', `(${formatCurrency(plData.totalExp)})`],
        ['', '', ''],
        [plData.netIncome >= 0 ? 'NET PROFIT' : 'NET LOSS', '', formatCurrency(plData.netIncome)]
      ];
      exportToPDF('Profit and Loss Statement', ['Description', '', 'Amount'], rows, [{ label: 'Net Income', value: formatCurrency(plData.netIncome) }]);
    } else if (activeTab === 'bs') {
      const assets = accountsByType('asset');
      const liabilities = accountsByType('liability');
      const equity = accountsByType('equity');
      
      const rows = [
        ['ASSETS', '', ''],
        ...assets.map(a => [a.name, '', formatCurrency(getAccountBalance(a, activeRange.end))]),
        ['TOTAL ASSETS', '', formatCurrency(assets.reduce((s, a) => s + getAccountBalance(a, activeRange.end), 0))],
        ['', '', ''],
        ['LIABILITIES & EQUITY', '', ''],
        ['Liabilities', '', ''],
        ...liabilities.map(l => [l.name, '', formatCurrency(getAccountBalance(l, activeRange.end))]),
        ['Equity', '', ''],
        ...equity.map(e => [e.name, '', formatCurrency(getAccountBalance(e, activeRange.end))]),
        ['Retained Earnings', '', formatCurrency(plData.netIncome)],
        ['TOTAL LIABILITIES & EQUITY', '', formatCurrency(liabilities.reduce((s, a) => s + getAccountBalance(a, activeRange.end), 0) + equity.reduce((s, a) => s + getAccountBalance(a, activeRange.end), 0) + plData.netIncome)]
      ];
      exportToPDF('Balance Sheet', ['Account', '', 'Balance'], rows);
    } else if (activeTab === 'tb') {
      const rows = tbData.map(r => [
        `${r.code} - ${r.name}`,
        r.debit > 0 ? formatCurrency(r.debit) : '-',
        r.credit > 0 ? formatCurrency(r.credit) : '-'
      ]);
      const totalDr = tbData.reduce((s: any, r: any) => s + r.debit, 0);
      const totalCr = tbData.reduce((s: any, r: any) => s + r.credit, 0);
      rows.push(['TOTALS', formatCurrency(totalDr), formatCurrency(totalCr)]);
      exportToPDF('Trial Balance', ['Account', 'Debit', 'Credit'], rows);
    } else {
      notify("Select P&L, BS or TB to export detailed report", "info");
    }
  };

  return (
    <div className="pt-1 pb-20 px-4 max-w-4xl mx-auto space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-xl font-bold text-[var(--text-bright)] tracking-tight">Finance Center</h2>
           <p className="text-[10px] text-[var(--muted)] font-bold tracking-wider leading-none mt-1">Visualizing {activeCompany.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-500 active:scale-95 transition-all"
          >
            <Download size={14} /> Download
          </button>
          <DateFilter range={rangeType} setRange={setRangeType} custom={customRange} setCustom={setCustomRange} />
        </div>
      </div>

      {/* Mini Nav */}
      <div className="flex bg-[var(--surface)] p-1.5 rounded-2xl border border-[var(--border)] overflow-x-auto no-scrollbar gap-1">
        {[
          { id: 'pl', label: 'Profit & Loss', icon: TrendingUp },
          { id: 'bs', label: 'Balance Sheet', icon: Scale },
          { id: 'tb', label: 'Trial Balance', icon: CheckCircle2 }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black tracking-wider transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-[var(--border)]'}`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'pl' && (
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-xl">
           <div className="p-6 border-b border-[var(--border)] bg-gradient-to-r from-blue-600/5 to-purple-600/5">
              <h3 className="text-xl font-black text-[var(--text-bright)]">Profit & Loss Statement</h3>
              <p className="text-[10px] text-[var(--muted)] font-black">For the period ending {activeRange.end}</p>
           </div>
           <div className="p-6 space-y-8">
              {/* Income */}
              <div className="space-y-4">
                 <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                    <span className="text-sm font-black text-[var(--muted)]">Operating Income</span>
                    <span className="text-sm font-black text-teal-400">Total Revenue</span>
                 </div>
                 {plData.revenues.map((r, i) => (
                    <div key={i} className="flex justify-between items-center text-sm font-medium pr-1">
                       <span className="text-[var(--text)]">{r.name}</span>
                       <span className="text-[var(--text-bright)]">{formatCurrency(r.amount)}</span>
                    </div>
                 ))}
                 <div className="flex justify-between items-center bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)] mt-2">
                    <span className="font-bold text-[var(--text-bright)]">Gross Profit</span>
                    <span className="font-black text-teal-400 text-lg">{formatCurrency(plData.totalRev)}</span>
                 </div>
              </div>

              {/* Expenses */}
              <div className="space-y-4">
                 <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                    <span className="text-sm font-black text-[var(--muted)]">Operating Expenses</span>
                    <span className="text-sm font-black text-orange-400">Total Spent</span>
                 </div>
                 {plData.expenses.map((e, i) => (
                    <div key={i} className="flex justify-between items-center text-sm font-medium pr-1">
                       <span className="text-[var(--text)]">{e.name}</span>
                       <span className="text-[var(--text-bright)] text-orange-400/80">{formatCurrency(e.amount)}</span>
                    </div>
                 ))}
                 <div className="flex justify-between items-center bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)] mt-2">
                    <span className="font-bold text-[var(--text-bright)]">Total Expenses</span>
                    <span className="font-black text-orange-400 text-lg">({formatCurrency(plData.totalExp)})</span>
                 </div>
              </div>

              {/* Net Income */}
              <div className={`p-4 rounded-3xl border-2 flex flex-col sm:flex-row justify-between items-center sm:items-end gap-3 shadow-xl overflow-hidden ${plData.netIncome >= 0 ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                 <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${plData.netIncome >= 0 ? 'bg-teal-500 text-white' : 'bg-red-500 text-white'}`}>
                       {plData.netIncome >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                       <p className="text-[9px] font-bold tracking-wider opacity-80 leading-none mb-1">Bottom Line</p>
                       <h3 className="text-base font-black leading-none">{plData.netIncome >= 0 ? 'Net Profit' : 'Net Loss'}</h3>
                    </div>
                 </div>
                 <div className="text-center sm:text-right w-full sm:w-auto mt-2 sm:mt-0">
                    <p className="text-2xl sm:text-2xl font-black tracking-tighter truncate leading-none mb-1">{formatCurrency(plData.netIncome)}</p>
                    <p className="text-[9px] font-bold opacity-60">Margin: {plData.totalRev > 0 ? ((plData.netIncome / plData.totalRev) * 100).toFixed(1) : '0'}%</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'bs' && (
        <div className="space-y-6">
           {/* Assets */}
           <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex justify-between items-center bg-teal-500/5">
                 <h4 className="font-black text-[var(--muted)] text-xs">Total Assets</h4>
                 <span className="text-lg font-black text-teal-400">{formatCurrency(accountsByType('asset').reduce((s, a: any) => s + getAccountBalance(a, activeRange.end), 0))}</span>
              </div>
              <div className="p-4 space-y-2">
                 {accountsByType('asset').map((a: any) => (
                    <div key={a.id} className="flex justify-between items-center p-3 hover:bg-[var(--bg)] rounded-xl transition-colors">
                       <span className="text-sm font-bold text-[var(--text-bright)]">{a.name}</span>
                       <span className="text-sm font-mono text-teal-400">{formatCurrency(getAccountBalance(a, activeRange.end))}</span>
                    </div>
                 ))}
              </div>
           </div>

           {/* Liabilities & Equity */}
           <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
              <div className="p-5 border-b border-[var(--border)] flex justify-between items-center bg-orange-500/5">
                 <h4 className="font-black text-[var(--muted)] text-xs">Total Liabilities & Equity</h4>
                 <span className="text-lg font-black text-orange-400">
                    {formatCurrency(
                        accountsByType('liability').reduce((s, a: any) => s + getAccountBalance(a, activeRange.end), 0) + 
                        accountsByType('equity').reduce((s, a: any) => s + getAccountBalance(a, activeRange.end), 0) + 
                        plData.netIncome
                    )}
                 </span>
              </div>
              <div className="p-4 space-y-4">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-[var(--muted)] ml-1 mb-2">Liabilities</p>
                    {accountsByType('liability').map((a: any) => (
                        <div key={a.id} className="flex justify-between items-center p-3 hover:bg-[var(--bg)] rounded-xl transition-colors">
                           <span className="text-sm font-medium text-[var(--text)]">{a.name}</span>
                           <span className="text-sm font-mono">{formatCurrency(getAccountBalance(a, activeRange.end))}</span>
                        </div>
                    ))}
                 </div>
                 <div className="space-y-1 pt-4 border-t border-[var(--border)]">
                    <p className="text-[10px] font-black text-[var(--muted)] ml-1 mb-2">Equity</p>
                    {accountsByType('equity').map((a: any) => (
                        <div key={a.id} className="flex justify-between items-center p-3 hover:bg-[var(--bg)] rounded-xl transition-colors">
                           <span className="text-sm font-medium text-[var(--text)]">{a.name}</span>
                           <span className="text-sm font-mono">{formatCurrency(getAccountBalance(a, activeRange.end))}</span>
                        </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-xl">
                       <span className="text-sm font-bold text-blue-400">Retained Earnings (P&L)</span>
                       <span className="text-sm font-mono font-bold text-blue-400">{formatCurrency(plData.netIncome)}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'tb' && (
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-2xl">
           <table className="w-full text-left text-sm border-collapse">
              <thead>
                 <tr className="bg-[var(--bg)]">
                    <th className="p-4 text-[10px] font-black text-[var(--muted)] border-b border-[var(--border)]">Account Description</th>
                    <th className="p-4 text-[10px] font-black text-[var(--muted)] border-b border-[var(--border)] text-right">Debit Balance</th>
                    <th className="p-4 text-[10px] font-black text-[var(--muted)] border-b border-[var(--border)] text-right">Credit Balance</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                 {tbData.map((row: any) => (
                    <tr key={row.id} className="hover:bg-[var(--bg)] transition-colors">
                       <td className="p-4">
                          <div className="font-bold text-[var(--text-bright)]">{row.name}</div>
                          <div className="text-[10px] text-[var(--muted)] font-bold">{row.code} ({row.type.charAt(0).toUpperCase() + row.type.slice(1)})</div>
                       </td>
                       <td className="p-4 text-right font-mono font-bold text-teal-400">
                          {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                       </td>
                       <td className="p-4 text-right font-mono font-bold text-orange-400">
                          {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                       </td>
                    </tr>
                 ))}
              </tbody>
              <tfoot className="bg-[var(--bg)] font-black">
                 <tr>
                    <td className="p-4 tracking-tighter">Trial Totals</td>
                    <td className="p-4 text-right border-t-2 border-teal-500 text-teal-400">
                       {formatCurrency(tbData.reduce((s: any, r: any) => s + r.debit, 0))}
                    </td>
                    <td className="p-4 text-right border-t-2 border-orange-500 text-orange-400">
                       {formatCurrency(tbData.reduce((s: any, r: any) => s + r.credit, 0))}
                    </td>
                 </tr>
              </tfoot>
           </table>
        </div>
      )}
    </div>
  );
};

const JournalEntryModal = ({ 
  isOpen, 
  onClose, 
  formData, 
  setFormData, 
  activeCompany, 
  onSave, 
  setPreviousModal,
  setShowModal,
  formatCurrency
}: any) => {
  const [editingLine, setEditingLine] = useState<any>(null);
  
  // Sync draft account if returned from new account modal
  useEffect(() => {
    if (formData.draft_accountId && editingLine) {
      setEditingLine((prev: any) => ({ ...prev, accountId: formData.draft_accountId }));
      const { draft_accountId, ...rest } = formData;
      setFormData(rest);
    }
  }, [formData.draft_accountId, setFormData, editingLine]);
  
  if (!isOpen || !activeCompany) return null;

  const items = formData.items || [];
  const totalDr = items.reduce((s: number, i: any) => s + (parseFloat(i.debit) || 0), 0);
  const totalCr = items.reduce((s: number, i: any) => s + (parseFloat(i.credit) || 0), 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01 && items.length >= 2;

  const handleOpenAddLine = () => {
    setEditingLine({
      id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'debit',
      accountId: '',
      amount: '',
      detail: formData.description || '',
      ref: formData.transactionRef || ''
    });
  };

  const handleOpenEditLine = (item: any) => {
    setEditingLine({
      ...item,
      amount: item.type === 'debit' ? item.debit : item.credit
    });
  };

  const handleApplyLine = () => {
    if (!editingLine.accountId || !editingLine.amount || parseFloat(editingLine.amount) <= 0) return;

    // Prevent duplicate accounts in the same entry
    const isDuplicate = items.some((i: any) => 
      i.accountId === editingLine.accountId && 
      i.id !== editingLine.id
    );

    if (isDuplicate) {
      alert("This account is already included in this entry. Please edit the existing line instead.");
      return;
    }

    const newItem = {
      ...editingLine,
      debit: editingLine.type === 'debit' ? editingLine.amount : '0',
      credit: editingLine.type === 'credit' ? editingLine.amount : '0'
    };

    const exists = items.find((i: any) => i.id === editingLine.id);
    if (exists) {
      setFormData({
        ...formData,
        items: items.map((i: any) => i.id === editingLine.id ? newItem : i)
      });
    } else {
      setFormData({
        ...formData,
        items: [...items, newItem]
      });
    }
    setEditingLine(null);
  };

  const removeItem = (id: number) => {
    setFormData({
      ...formData,
      items: items.filter((i: any) => i.id !== id)
    });
  };

  return (
    <Modal 
      title={formData.transactionId ? "Edit Entry" : "Add"} 
      onConfirm={onSave} 
      onClose={onClose}
      confirmText={isBalanced ? (formData.transactionId ? "Update Entry" : "Post Entry") : "Unbalanced"}
      disabled={!isBalanced}
    >
      <div className="space-y-4">
        {/* Main Header */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--muted)]">Date</label>
            <input 
              type="date" 
              value={formData.date || ""} 
              onChange={e => setFormData({...formData, date: e.target.value})} 
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500/50 text-[var(--text-bright)]" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--muted)]">Ref</label>
            <input 
              type="text" 
              placeholder="GJ-..."
              value={formData.transactionRef || ""} 
              onChange={e => setFormData({...formData, transactionRef: e.target.value})} 
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500/50 text-[var(--text-bright)]" 
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center bg-[var(--surface)] p-2 rounded-xl border border-[var(--border)]">
          <div className="text-[9px] font-black text-[var(--muted)] ml-2">
            {items.length} Lines
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button 
                type="button"
                onClick={() => {
                  const reversedItems = items.map((item: any) => {
                    const isDebit = item.type === 'debit';
                    return {
                      ...item,
                      type: isDebit ? 'credit' : 'debit',
                      debit: isDebit ? '0' : item.credit,
                      credit: isDebit ? item.debit : '0',
                    };
                  });
                  setFormData({
                    ...formData,
                    items: reversedItems
                  });
                }}
                className="px-2.5 py-1.5 text-blue-400 hover:text-blue-300 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/15 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 active:scale-95"
                title="Swap debits and credits for all lines"
              >
                <ArrowUpDown size={12} />
                Reverse DR/CR Lines
              </button>
            )}
            <button 
              type="button"
              onClick={handleOpenAddLine}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus size={14} />
              Add Line
            </button>
          </div>
        </div>

        {/* Lines Table */}
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)] max-h-[35vh] overflow-y-auto native-scroll">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[var(--card)] sticky top-0 z-10">
              <tr>
                <th className="p-2.5 text-[9px] font-black text-[var(--muted)] border-b border-[var(--border)]">Account</th>
                <th className="p-2.5 text-[9px] font-black text-[var(--muted)] border-b border-[var(--border)] text-right">Debit</th>
                <th className="p-2.5 text-[9px] font-black text-[var(--muted)] border-b border-[var(--border)] text-right">Credit</th>
                <th className="p-2.5 text-[9px] font-black text-[var(--muted)] border-b border-[var(--border)] w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.length > 0 ? items.map((item: any) => {
                const acc = activeCompany?.accounts.find((a: any) => a.id.toString() === item.accountId);
                return (
                  <tr 
                    key={item.id} 
                    className="hover:bg-[var(--card)] transition-colors cursor-pointer group"
                    onClick={() => handleOpenEditLine(item)}
                  >
                    <td className="p-2.5 text-left">
                      <div className="font-bold text-[var(--text-bright)] truncate max-w-[100px]">{acc ? acc.name : 'Select Account...'}</div>
                      <div className="text-[8px] text-[var(--muted)]">{acc?.code}</div>
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-teal-400">
                      {parseFloat(item.debit) > 0 ? parseFloat(item.debit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-orange-400">
                      {parseFloat(item.credit) > 0 ? parseFloat(item.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="p-2.5 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        className="p-1 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 size={10} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--muted)] text-[10px] italic">No lines added.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Totals */}
        <div className="p-3 bg-[var(--bg)] rounded-xl border border-dashed border-[var(--border)] flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-[var(--muted)]">Dr</span>
            <span className="text-teal-400 font-bold text-xs tracking-tight">{formatCurrency(totalDr)}</span>
          </div>
          <div className="flex flex-col items-center">
             <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-tighter shadow-sm border ${isBalanced ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              {isBalanced ? 'Balanced' : `-${formatCurrency(Math.abs(totalDr - totalCr))}`}
            </div>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[8px] font-black text-[var(--muted)]">Cr</span>
            <span className="text-orange-400 font-bold text-xs tracking-tight">{formatCurrency(totalCr)}</span>
          </div>
        </div>

        {/* Line Editor Overlay */}
        <AnimatePresence>
          {editingLine && (
            <motion.div 
              key="line-editor-overlay"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="absolute inset-0 z-[110] bg-[var(--card)] p-6 flex flex-col justify-center border-t border-[var(--border)] rounded-3xl"
            >
              <div className="space-y-4 max-w-sm mx-auto w-full">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-lg font-black uppercase tracking-tight text-blue-500">
                    {items.some((i: any) => i.id === editingLine.id) ? "Edit Entry" : "Add"}
                  </h4>
                  <button onClick={() => setEditingLine(null)} className="p-2 hover:bg-[var(--surface)] text-[var(--muted)] rounded-full">
                    <X size={18} />
                  </button>
                </div>

                {/* Dr/Cr Tabs */}
                <div className="flex bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)]">
                  <button 
                    onClick={() => setEditingLine({...editingLine, type: 'debit'})}
                    className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${editingLine.type === 'debit' ? 'bg-teal-500 text-white shadow-lg' : 'text-[var(--muted)] hover:text-white'}`}
                  >
                    DEBIT (DR)
                  </button>
                  <button 
                    onClick={() => setEditingLine({...editingLine, type: 'credit'})}
                    className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${editingLine.type === 'credit' ? 'bg-orange-500 text-white shadow-lg' : 'text-[var(--muted)] hover:text-white'}`}
                  >
                    CREDIT (CR)
                  </button>
                </div>

                <SearchableSelect 
                  label="Account"
                  placeholder="Select Account"
                  value={editingLine.accountId}
                  options={(activeCompany?.accounts || [])
                    .filter((a: any) => !items.some((i: any) => i.accountId === a.id.toString() && i.id !== editingLine.id))
                    .map((a: any) => ({ value: a.id.toString(), label: `${a.code} - ${a.name}` }))
                  }
                  onChange={(val: string) => setEditingLine({...editingLine, accountId: val})}
                  onAddClick={() => { 
                    setPreviousModal(formData.transactionId ? 'edit_entry' : 'new_entry'); 
                    setFormData({...formData, accountSourceField: 'draft_accountId'}); 
                    setShowModal('new_account'); 
                  }}
                />

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[var(--muted)] uppercase">Amount</label>
                  <input 
                    type="number"
                    placeholder="0.00"
                    value={editingLine.amount}
                    onChange={e => setEditingLine({...editingLine, amount: e.target.value})}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-lg font-black outline-none focus:border-blue-500 text-[var(--text-bright)]"
                  />
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-[var(--muted)] uppercase">Detail</label>
                    <input 
                      type="text"
                      placeholder="Line detail"
                      value={editingLine.detail}
                      onChange={e => setEditingLine({...editingLine, detail: e.target.value})}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-[var(--muted)] uppercase">Reference</label>
                    <input 
                      type="text"
                      placeholder="Line ref"
                      value={editingLine.ref}
                      onChange={e => setEditingLine({...editingLine, ref: e.target.value})}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button 
                    type="button"
                    onClick={() => setEditingLine(null)}
                    className="flex-1 py-2 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--muted)] hover:bg-[var(--surface)] transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleApplyLine}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    Apply Line
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
};


const SingleEntryModal = ({ 
  isOpen, 
  onClose, 
  formData, 
  setFormData, 
  activeCompany, 
  onSave, 
  setPreviousModal,
  setShowModal,
  formatCurrency
}: any) => {
  if (!isOpen || !activeCompany) return null;

  return (
    <Modal 
      title={formData.transactionId ? "Edit Entry" : "Add"} 
      onConfirm={onSave} 
      onClose={onClose}
      confirmText={formData.transactionId ? "Update Entry" : "Post Entry"}
    >
      <div className="space-y-4">
        <div className="space-y-1.5 focus-within:z-10">
          <label className="text-[10px] font-black text-[var(--muted)]">Transaction Date</label>
          <input type="date" value={formData.date || ""} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchableSelect 
            label="Debit (Increase Asset/Exp)"
            placeholder="Select Account"
            value={formData.debitAccountId}
            colorClass="text-teal-400"
            options={activeCompany?.accounts.filter((a: any) => a.id.toString() !== formData.creditAccountId).map((a: any) => ({ value: a.id.toString(), label: `${a.code} - ${a.name}` })) || []}
            onChange={(val: string) => setFormData({ ...formData, debitAccountId: val })}
            onAddClick={() => { setPreviousModal('new_entry_single'); setFormData({...formData, accountSourceField: 'debitAccountId'}); setShowModal('new_account'); }}
          />
          <SearchableSelect 
            label="Credit (Dec Asset / Inc Liab)"
            placeholder="Select Account"
            value={formData.creditAccountId}
            colorClass="text-orange-400"
            options={activeCompany?.accounts.filter((a: any) => a.id.toString() !== formData.debitAccountId).map((a: any) => ({ value: a.id.toString(), label: `${a.code} - ${a.name}` })) || []}
            onChange={(val: string) => setFormData({ ...formData, creditAccountId: val })}
            onAddClick={() => { setPreviousModal('new_entry_single'); setFormData({...formData, accountSourceField: 'creditAccountId'}); setShowModal('new_account'); }}
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => {
              setFormData({
                ...formData,
                debitAccountId: formData.creditAccountId || "",
                creditAccountId: formData.debitAccountId || ""
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black text-blue-400 hover:text-blue-300 bg-blue-500/0 hover:bg-blue-500/5 border border-blue-500/10 rounded-xl transition-all active:scale-95"
            title="Swap Debit and Credit Accounts"
          >
            <ArrowUpDown size={12} />
            Reverse Dr/Cr (Swap Accounts)
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-[var(--muted)]">Amount</label>
          <input 
            type="number" 
            placeholder="0.00" 
            value={formData.amount || ""} 
            onChange={e => setFormData({...formData, amount: e.target.value})} 
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-xl font-black text-[var(--text-bright)] outline-none focus:border-blue-500/50" 
          />
        </div>

        <div className="space-y-1.5">
           <label className="text-[10px] font-black text-[var(--muted)]">Notes / Reference</label>
           <input type="text" placeholder="Description" value={formData.description || ""} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]" />
           <input type="text" placeholder="Reference #" value={formData.reference || ""} onChange={e => setFormData({...formData, reference: e.target.value})} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 mt-2 outline-none focus:border-blue-500/50 text-[var(--text-bright)]" />
        </div>
      </div>
    </Modal>
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
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<number | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [journalSort, setJournalSort] = useState<'desc' | 'asc'>('desc');
  const [dashboardSort, setDashboardSort] = useState<'desc' | 'asc'>('desc');
  const [accountSort, setAccountSort] = useState<'name_asc' | 'name_desc' | 'code_asc'>('name_asc');
  const [rangeType, setRangeType] = useState<DateRangeType>('this_month');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [activeReportTab, setActiveReportTab] = useState<'summary' | 'pl' | 'bs' | 'tb' | 'cashflow'>('summary');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${day}`;
    return { start: formatted, end: formatted };
  });

  const activeRange = useMemo(() => getDatesForRange(rangeType, customRange), [rangeType, customRange]);

  // Handle auto-refresh/sync
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey(prev => prev + 1), []);

  // Initialize
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    loadAppData().then(d => {
      setData(d);
      const savedCid = localStorage.getItem(ACTIVE_COMPANY_KEY);
      if (savedCid) {
        const cid = parseInt(savedCid);
        const comp = d.companies.find(c => c.id === cid);
        if (comp) {
          setSelectedCompanyId(cid);
          if (!comp.pin) {
            setIsUnlocked(true);
            setView('dashboard');
          } else {
            setIsUnlocked(false);
            setView('dashboard'); // Overlay over dashboard instead of going to companies
          }
        }
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
    return data.nextId;
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
    if (formData.pin && !/^\d{4}$/.test(formData.pin)) return notify("PIN must be 4 digits", "error");
    
    const id = data.nextId;
    setData(prev => ({
      ...prev,
      nextId: Math.max(prev.nextId, id + 1),
      companies: [...prev.companies, {
        id,
        name: formData.name,
        industry: formData.industry || "",
        currency: formData.currency || "PKR",
        pin: formData.pin || undefined,
        accounts: [],
        createdAt: new Date().toISOString()
      }]
    }));
    
    setSelectedCompanyId(id);
    setIsUnlocked(true); // Auto-unlock for the creator
    localStorage.setItem(ACTIVE_COMPANY_KEY, id.toString());
    setShowModal(null);
    setFormData({});
    setView('dashboard');
    notify(`Company "${formData.name}" created`);
  };

  const handleUpdateCompany = () => {
    if (!formData.name) return notify("Name is required", "error");
    if (formData.pin && !/^\d{4}$/.test(formData.pin)) return notify("PIN must be 4 digits", "error");
    
    setData(prev => ({
      ...prev,
      companies: prev.companies.map(c => c.id === formData.id ? { ...c, ...formData } : c)
    }));
    setShowModal(null);
    notify("Company updated");
  };

  const handleDeleteCompanyClick = (comp: Company) => {
    setCompanyToDelete(comp);
    setFormData({});
    setShowModal('delete_company_confirm');
  };

  const handleCreateAccount = () => {
    if (!formData.name || !formData.type) return notify("Missing required fields", "error");
    
    const id = data.nextId;
    setData(prev => {
      const actualId = Math.max(prev.nextId, id);
      const newAccount: Account = {
        id: actualId,
        name: formData.name,
        code: formData.code || "",
        type: formData.type,
        description: formData.description || "",
        openingBalance: parseFloat(formData.openingBalance) || 0,
        entries: [],
        createdAt: new Date().toISOString()
      };

      const updatedCompanies = prev.companies.map(c => 
        c.id === selectedCompanyId ? { ...c, accounts: [...c.accounts, newAccount] } : c
      );

      return {
        ...prev,
        nextId: actualId + 1,
        companies: updatedCompanies
      };
    });
    
    if (previousModal === 'new_entry' || previousModal === 'edit_entry' || previousModal === 'new_entry_single' || previousModal === 'edit_entry_single') {
      const field = formData.accountSourceField;
      
      // Preserve existing form data but update the target field
      const newFormData = { ...formData };
      
      // If description was empty, maybe use account name as a hint
      if (formData.name && (!newFormData.description && !newFormData.detail)) {
        newFormData.description = formData.name;
      }

      delete newFormData.name;
      delete newFormData.type;
      delete newFormData.code;
      delete newFormData.openingBalance;
      
      if (field === 'draft_accountId') {
        newFormData.draft_accountId = id.toString();
      } else if (field === 'accountId_in_item') {
        const itemId = formData.currentEditItemId;
        newFormData.items = (formData.items || []).map((i: any) => i.id === itemId ? { ...i, accountId: id.toString() } : i);
        newFormData.currentEditItemId = null;
      } else if (field) {
        newFormData[field] = id.toString();
      }
      
      newFormData.accountSourceField = null;
      setFormData(newFormData);
      setShowModal(previousModal);
      setPreviousModal(null);
    } else {
      setShowModal(null);
      setFormData({});
    }
    notify(`Account "${formData.name}" added`);
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
    setAccountToDelete(id);
    setShowModal('delete_confirm_account');
  };

  const confirmDeleteAccount = () => {
    if (!accountToDelete) return;
    
    if (activeCompany?.pin) {
      if (!formData.pinConfirm || formData.pinConfirm !== activeCompany.pin) {
        return notify("Invalid security PIN", "error");
      }
    }

    setData(prev => ({
      ...prev,
      companies: prev.companies.map(c => 
        c.id === selectedCompanyId ? { ...c, accounts: c.accounts.filter(a => a.id !== accountToDelete) } : c
      )
    }));
    setAccountToDelete(null);
    setShowModal(null);
    setFormData({});
    notify("Account deleted", "error");
  };

  const handleSaveEntry = () => {
    const { items, date, transactionId, transactionRef, debitAccountId, creditAccountId, amount, description, reference } = formData;
    
    // Check if it's a single entry save
    if ((showModal === 'new_entry_single' || showModal === 'edit_entry_single') && debitAccountId && creditAccountId && amount) {
      const amt = parseFloat(amount);
      const txnId = transactionId || data.nextId;
      
      const drAccId = parseInt(debitAccountId);
      const crAccId = parseInt(creditAccountId);

      setData(prev => {
        let currentNextId = prev.nextId;
        const finalTxnId = transactionId || currentNextId++;
        
        const dEntry: Entry = {
          id: currentNextId++,
          transactionId: finalTxnId,
          date,
          description: description || "",
          type: 'debit',
          amount: amt,
          reference: reference || "",
          contraAccountId: crAccId
        };
        
        const cEntry: Entry = {
          id: currentNextId++,
          transactionId: finalTxnId,
          date,
          description: description || "",
          type: 'credit',
          amount: amt,
          reference: reference || "",
          contraAccountId: drAccId
        };

        const updatedCompanies = prev.companies.map(c => 
          c.id === selectedCompanyId ? {
            ...c,
            accounts: c.accounts.map(a => {
              const clean = transactionId ? a.entries.filter(e => e.transactionId !== transactionId) : a.entries;
              if (a.id === drAccId) return { ...a, entries: [...clean, dEntry] };
              if (a.id === crAccId) return { ...a, entries: [...clean, cEntry] };
              return { ...a, entries: clean };
            })
          } : c
        );

        return { ...prev, nextId: currentNextId, lastUsedDate: date, companies: updatedCompanies };
      });

      setShowModal(null);
      setFormData({});
      notify(transactionId ? "Entry updated" : "Entry recorded");
      return;
    }

    // Multiline save
    if (!date || !items || items.length < 2) return notify("At least 2 items required", "error");
    
    // Calculate totals
    const totalDebit = items.reduce((sum: number, item: any) => sum + (parseFloat(item.debit) || 0), 0);
    const totalCredit = items.reduce((sum: number, item: any) => sum + (parseFloat(item.credit) || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return notify(`Out of balance! Diff: ${formatCurrency(totalDebit - totalCredit)}`, "error");
    }

    setData(prev => {
      let currentNextId = prev.nextId;
      const txnId = transactionId || currentNextId++;
      
      const newEntriesByAccount: { [key: number]: Entry[] } = {};

      const isTwoLine = items.length === 2;
      const accId0 = parseInt(items[0]?.accountId);
      const accId1 = parseInt(items[1]?.accountId);

      items.forEach((item: any, index: number) => {
        const accId = parseInt(item.accountId);
        if (isNaN(accId)) return;

        const isDebit = (parseFloat(item.debit) || 0) > 0;
        const itemAmount = isDebit ? parseFloat(item.debit) : parseFloat(item.credit);
        
        if (itemAmount <= 0) return;

        let contraAccountId = -1;
        if (isTwoLine) {
          contraAccountId = index === 0 ? accId1 : accId0;
        }

        const entry: Entry = {
          id: currentNextId++,
          transactionId: txnId,
          date,
          description: item.detail || "",
          type: isDebit ? 'debit' : 'credit',
          amount: itemAmount,
          reference: item.ref || transactionRef || "",
          contraAccountId
        };

        if (!newEntriesByAccount[accId]) newEntriesByAccount[accId] = [];
        newEntriesByAccount[accId].push(entry);
      });

      const updatedCompanies = prev.companies.map(c => 
        c.id === selectedCompanyId ? {
          ...c,
          accounts: c.accounts.map(a => {
            const cleanEntries = transactionId ? a.entries.filter(e => e.transactionId !== transactionId) : a.entries;
            const extraEntries = newEntriesByAccount[a.id] || [];
            return { ...a, entries: [...cleanEntries, ...extraEntries] };
          })
        } : c
      );

      return {
        ...prev,
        nextId: currentNextId,
        lastUsedDate: date,
        companies: updatedCompanies
      };
    });

    setShowModal(null);
    setFormData({});
    notify(transactionId ? "Transaction updated" : "Transaction recorded");
  };

  const handleDeleteTransaction = (txnId: number) => {
    if (activeCompany?.pin) {
      if (!formData.pinConfirm || formData.pinConfirm !== activeCompany.pin) {
        return notify("Invalid security PIN", "error");
      }
    }

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
    setTransactionToDelete(null);
    setShowModal(null);
    setFormData({});
    notify("Transaction deleted", "success");
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
    const sorted = [...acc.entries].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime() || a.id - b.id);
    
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
    <div className="space-y-4 pt-1 pb-20 px-4 max-w-2xl mx-auto animate-slide-up">
      <div className="flex justify-between items-end mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-bold">Workspace</span>
          <h2 className="text-2xl font-bold text-[var(--text-bright)]">Businesses</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/20 transition-all active:scale-95 cursor-pointer select-none">
            <Upload size={14} /> Import Backup
            <input type="file" accept=".json" onChange={importData} className="hidden" />
          </label>
          <button 
            onClick={() => { setFormData({}); setShowModal('new_company'); }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all active:scale-95"
          >
            <Plus size={14} /> New Business
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {data.companies.map(c => (
          <motion.div 
            key={c.id} 
            layoutId={`company-${c.id}`}
            onClick={() => { 
              setSelectedCompanyId(c.id); 
              setEnteredPin("");
              if (c.pin) {
                setIsUnlocked(false);
              } else {
                setIsUnlocked(true);
                setView('dashboard');
              }
              localStorage.setItem(ACTIVE_COMPANY_KEY, c.id.toString()); 
            }}
            className="p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] flex items-center justify-between group cursor-pointer active:scale-[0.98] transition-all shadow-sm relative z-0 hover:z-30 focus-within:z-30"
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
                { label: 'Edit', icon: Edit3, onClick: () => { setFormData(c); setShowModal('edit_company'); } },
                { label: 'Delete', icon: Trash2, onClick: () => handleDeleteCompanyClick(c), danger: true }
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
               <p className="text-sm text-[var(--muted)]">Create your first company or import a backup to start bookkeeping.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
              <button onClick={() => setShowModal('new_company')} className="btn-primary w-full sm:w-auto justify-center">
                 <Plus size={18} /> Add Business
              </button>
              <label className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl cursor-pointer transition-all text-xs tracking-wider uppercase select-none shadow-lg shadow-purple-500/20 active:scale-95 w-full sm:w-auto">
                 <Upload size={18} /> Import Backup
                 <input type="file" accept=".json" onChange={importData} className="hidden" />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // --- Common Helpers ---
  const handleEditTransaction = (txId: number) => {
    if (!activeCompany) return;
    const txnItems: any[] = [];
    let txnDate = "";
    let txnRef = "";
    let isSingleEntryFormat = true;
    let drAccId = "";
    let crAccId = "";
    let amt = 0;
    let desc = "";

    let entriesCount = 0;
    activeCompany.accounts.forEach(acc => {
      acc.entries.filter(e => e.transactionId === txId).forEach(e => {
        entriesCount++;
        txnDate = e.date;
        txnRef = e.reference;
        desc = e.description;
        amt = e.amount;
        if (e.type === 'debit') drAccId = acc.id.toString();
        else crAccId = acc.id.toString();

        txnItems.push({
          id: e.id,
          accountId: acc.id.toString(),
          detail: e.description,
          ref: e.reference,
          debit: e.type === 'debit' ? e.amount.toString() : '0',
          credit: e.type === 'credit' ? e.amount.toString() : '0',
          type: e.type
        });
      });
    });

    if (entriesCount !== 2) isSingleEntryFormat = false;

    setFormData({
      transactionId: txId,
      date: txnDate,
      transactionRef: txnRef,
      items: txnItems,
      debitAccountId: drAccId,
      creditAccountId: crAccId,
      amount: amt.toString(),
      description: desc,
      reference: txnRef
    });
    
    setShowModal('edit_entry');
  };

  const handleCreateReversal = (txId: number) => {
    if (!activeCompany) return;

    setData(prev => {
      const updatedCompanies = prev.companies.map(c => {
        if (c.id !== selectedCompanyId) return c;

        const updatedAccounts = c.accounts.map(acc => {
          const updatedEntries = acc.entries.map(e => {
            if (e.transactionId === txId) {
              const flippedType: 'debit' | 'credit' = e.type === 'debit' ? 'credit' : 'debit';
              const refStr = e.reference || "";
              const flippedRef = refStr.startsWith('REV-') ? refStr.substring(4) : `REV-${refStr}`;
              return {
                ...e,
                type: flippedType,
                reference: flippedRef
              };
            }
            return e;
          });
          return { ...acc, entries: updatedEntries };
        });
        return { ...c, accounts: updatedAccounts };
      });
      return { ...prev, companies: updatedCompanies };
    });

    notify("Transaction reversed (swapped DR/CR)");
  };

  const renderDashboard = () => {
    if (!activeCompany) return null;

    // If pin not set, show alert
    const pinAlert = (() => {
      if (activeCompany.pin) return null;
      return (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 shadow-lg shadow-orange-500/5"
        >
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
                <AlertCircle size={24} />
              </div>
              <div className="text-left">
                 <p className="text-sm font-black text-[var(--text-bright)] uppercase tracking-tight">Security Reminder</p>
                 <p className="text-[10px] text-[var(--muted)] font-black uppercase">Your financial data is currently unprotected. Set a 4-digit PIN for privacy.</p>
              </div>
           </div>
           <button 
             onClick={() => { setFormData(activeCompany || {}); setShowModal('edit_company'); }}
             className="w-full sm:w-auto px-6 py-2.5 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95"
           >
             Secure Now
           </button>
        </motion.div>
      );
    })();

    // Get latest 10 transactions across all accounts
    const allEntries: (Entry & { accountName: string; accountId: number; accountType: AccountType })[] = [];
    activeCompany.accounts.forEach(acc => {
      acc.entries.forEach(e => {
        allEntries.push({ ...e, accountName: acc.name, accountId: acc.id, accountType: acc.type });
      });
    });

    const latestEntries = [...allEntries]
      .filter(e => e.date >= activeRange.start && e.date <= activeRange.end)
      .filter(e => 
        e.description.toLowerCase().includes(dashboardSearch.toLowerCase()) || 
        e.accountName.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
        e.amount.toString().includes(dashboardSearch)
      )
      .sort((a, b) => {
        const timeA = parseDate(a.date).getTime();
        const timeB = parseDate(b.date).getTime();
        return dashboardSort === 'desc' ? (timeB - timeA || b.id - a.id) : (timeA - timeB || a.id - b.id);
      });

    return (
      <div className="pt-1 pb-20 px-4 max-w-2xl mx-auto space-y-3 animate-slide-up">
        {pinAlert}
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col gap-0.1">
              <span className="text-[8px] tracking-wider text-[var(--muted)] font-black">Overview</span>
             <h2 className="text-lg font-bold text-[var(--text-bright)]">{activeCompany.name}</h2>
          </div>
          <DateFilter range={rangeType} setRange={setRangeType} custom={customRange} setCustom={setCustomRange} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm">
            <p className="text-[8px] font-black text-[var(--muted)]">Opening</p>
            <h3 className="text-[11px] font-bold text-[var(--text-bright)] mt-0.5 truncate leading-none">
              {formatCurrency(activeCompany.accounts.reduce((s, a) => s + getAccountBalance(a, formatDate(new Date(parseDate(activeRange.start).getTime() - 86400000))), 0))}
            </h3>
          </div>
          <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm">
            <p className="text-[8px] font-black text-teal-400">Debit (+)</p>
            <h3 className="text-[11px] font-bold text-[var(--text-bright)] mt-0.5 truncate leading-none">
              {formatCurrency(activeCompany.accounts.reduce((sum, a) => sum + a.entries.filter(e => e.date >= activeRange.start && e.date <= activeRange.end && e.type === 'debit' && (!e.reference || !e.reference.toUpperCase().startsWith("REV"))).reduce((s, e) => s + e.amount, 0), 0))}
            </h3>
          </div>
          <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-sm">
            <p className="text-[8px] font-black text-orange-400">Credit (-)</p>
            <h3 className="text-[11px] font-bold text-[var(--text-bright)] mt-0.5 truncate leading-none">
              {formatCurrency(activeCompany.accounts.reduce((sum, a) => sum + a.entries.filter(e => e.date >= activeRange.start && e.date <= activeRange.end && e.type === 'credit' && (!e.reference || !e.reference.toUpperCase().startsWith("REV"))).reduce((s, e) => s + e.amount, 0), 0))}
            </h3>
          </div>
          <div className="p-2.5 bg-[var(--surface)] rounded-xl border border-blue-500/20 bg-blue-500/5 shadow-sm">
            <p className="text-[8px] font-black text-blue-400">Closing</p>
            <h3 className="text-[11px] font-black text-[var(--text-bright)] mt-0.5 truncate leading-none">
              {formatCurrency(activeCompany.accounts.reduce((s, a) => s + getAccountBalance(a, activeRange.end), 0))}
            </h3>
          </div>
        </div>

        <div className="space-y-2.5 mt-4">
        <div className="flex items-center gap-2 mt-4 px-1">
          <div className="flex-1 relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] transition-colors group-focus-within:text-blue-500" size={10} />
            <input 
              type="text" 
              placeholder="Search description, account or amount..." 
              value={dashboardSearch}
              onChange={e => setDashboardSearch(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg py-1.5 pl-7 pr-8 text-[9px] font-bold outline-none focus:border-blue-500/50 w-full transition-all placeholder:text-[var(--muted)]/50 h-7"
            />
            {dashboardSearch && (
              <button 
                onClick={() => setDashboardSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-red-400 transition-colors"
                title="Clear Search"
              >
                <X size={10} />
              </button>
            )}
          </div>
          
          <button 
            onClick={() => setDashboardSort(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="p-1 px-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[9px] font-bold text-[var(--muted)] uppercase flex items-center gap-1.5 hover:text-[var(--text-bright)] transition-colors h-7 shrink-0"
            title="Toggle Sort Order"
          >
            <ArrowUpDown size={10} />
            <span className="hidden sm:inline">{dashboardSort === 'desc' ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
          
          <div className="space-y-2">
            {latestEntries.map(entry => {
              const contra = activeCompany.accounts.find(a => a.id === entry.contraAccountId);
              const typeInfo = ACCOUNT_TYPES.find(t => t.value === entry.accountType);
              const isPositiveEffect = entry.type === typeInfo?.normal;
              return (
                <div 
                  key={`${entry.accountId}-${entry.id}`} 
                  className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)] relative z-0 hover:z-30 focus-within:z-30 active:scale-[0.99] transition-all cursor-pointer hover:border-blue-500/30"
                  onClick={() => handleEditTransaction(entry.transactionId)}
                >
                  <div className="flex justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded border border-[var(--border)]">{entry.date}</span>
                      {entry.reference && <span className="text-[8px] font-black text-blue-400 border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 rounded">{entry.reference}</span>}
                    </div>
                    <EllipsisMenu options={[
                       { label: 'Edit', icon: Edit3, onClick: () => handleEditTransaction(entry.transactionId) },
                       { label: 'Reverse Entry', icon: ArrowUpDown, onClick: () => handleCreateReversal(entry.transactionId) },
                       { label: 'Delete', icon: Trash2, onClick: () => { setTransactionToDelete(entry.transactionId); setShowModal('delete_confirm'); }, danger: true }
                    ]} />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-bold text-[var(--text-bright)] leading-tight line-clamp-1">{entry.description || 'General Entry'}</p>
                      <p className="text-[9px] text-[var(--muted)] font-black flex items-center gap-1.5 mt-0.5">
                        <span className="truncate max-w-[80px] sm:max-w-[150px]">{entry.accountName}</span>
                        <span className="opacity-40">↔</span>
                        <span className="text-blue-400/80 truncate max-w-[80px] sm:max-w-[150px]">{contra?.name || 'External'}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black ${isPositiveEffect ? 'text-teal-400' : 'text-orange-400'}`}>
                        {isPositiveEffect ? '+' : '-'}{formatCurrency(entry.amount)}
                      </p>
                    </div>
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
      .sort((a, b) => {
        if (accountSort === 'name_asc') return a.name.localeCompare(b.name);
        if (accountSort === 'name_desc') return b.name.localeCompare(a.name);
        return a.code.localeCompare(b.code);
      }) || [];

    const companyOpening = activeCompany?.accounts.reduce((s, a) => s + getAccountBalance(a, formatDate(new Date(parseDate(activeRange.start).getTime() - 86400000))), 0) || 0;
    const companyDebit = activeCompany?.accounts.reduce((sum, a) => sum + a.entries.filter(e => e.date >= activeRange.start && e.date <= activeRange.end && e.type === 'debit' && (!e.reference || !e.reference.toUpperCase().startsWith("REV"))).reduce((s, e) => s + e.amount, 0), 0) || 0;
    const companyCredit = activeCompany?.accounts.reduce((sum, a) => sum + a.entries.filter(e => e.date >= activeRange.start && e.date <= activeRange.end && e.type === 'credit' && (!e.reference || !e.reference.toUpperCase().startsWith("REV"))).reduce((s, e) => s + e.amount, 0), 0) || 0;
    const companyClosing = activeCompany?.accounts.reduce((s, a) => s + getAccountBalance(a, activeRange.end), 0) || 0;

    return (
      <div className="pt-1 pb-20 px-4 max-w-2xl mx-auto space-y-4 animate-slide-up">
        <div className="flex flex-col gap-0.5 mb-2">
          <span className="text-[9px] tracking-wider text-[var(--muted)] font-black">Directory</span>
          <h2 className="text-2xl font-black text-[var(--text-bright)]">Chart of Accounts</h2>
        </div>

        {/* Live Data Cards (Stats Grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-[var(--muted)]">Opening</p>
            <p className="text-xs font-bold text-[var(--text-bright)] truncate">{formatCurrency(companyOpening)}</p>
          </div>
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-teal-400">Debit (+)</p>
            <p className="text-xs font-bold text-[var(--text-bright)] truncate">{formatCurrency(companyDebit)}</p>
          </div>
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-orange-400">Credit (-)</p>
            <p className="text-xs font-bold text-[var(--text-bright)] truncate">{formatCurrency(companyCredit)}</p>
          </div>
          <div className="p-2.5 bg-[var(--surface)] border border-blue-500/20 bg-blue-500/5 rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-blue-400">Closing</p>
            <p className="text-xs font-black text-[var(--text-bright)] truncate">{formatCurrency(companyClosing)}</p>
          </div>
        </div>

        <div className="flex gap-2 h-11 items-center bg-[var(--bg)] py-1 sticky top-14 z-20">
          <div className="relative flex-1 h-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-blue-500 transition-colors" size={14} />
            <input 
              type="text" 
              placeholder="Search accounts name or code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-10 pr-10 text-xs font-bold outline-none focus:border-blue-500/50 transition-all text-[var(--text-bright)] placeholder:text-[var(--muted)]/50"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[var(--muted)] hover:text-red-400 transition-colors"
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button 
            onClick={() => setAccountSort(prev => prev === 'name_asc' ? 'name_desc' : 'name_asc')}
            className="w-11 h-11 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--muted)] hover:text-white transition-all active:scale-95"
            title="Sort"
          >
            <ArrowUpDown size={18} />
          </button>
          <button 
            onClick={() => { setFormData({}); setShowModal('new_account'); }}
            className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all shrink-0"
            title="Add Account"
          >
            <Plus size={22} />
          </button>
        </div>

        <div className="space-y-3 mt-2">
          {filtered.map(acc => {
            const balance = getAccountBalance(acc, activeRange.end);
            return (
              <div 
                key={acc.id}
                onClick={() => { setSelectedAccountId(acc.id); setView('journal'); }}
                className="p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer shadow-sm relative z-0 hover:z-30 focus-within:z-30 hover:border-blue-500/30"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[var(--text-bright)] leading-tight">{acc.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[var(--muted)] font-black tracking-tight">{acc.code}</span>
                    <span className="w-1 h-1 rounded-full bg-[var(--border)]"></span>
                    <span className="text-[9px] font-black text-blue-500/80 capitalize">{acc.type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-sm font-black ${balance >= 0 ? 'text-[var(--text-bright)]' : 'text-red-400'}`}>
                      {formatCurrency(balance)}
                    </p>
                  </div>
                  <EllipsisMenu options={[
                    { label: 'Journal', icon: FileText, onClick: () => { setSelectedAccountId(acc.id); setView('journal'); } },
                    { label: 'Edit', icon: Edit3, onClick: () => { setFormData(acc); setShowModal('edit_account'); } },
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
    
    const typeInfo = ACCOUNT_TYPES.find(t => t.value === activeAccount.type);
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
      const opening = getAccountBalance(activeAccount, formatDate(new Date(parseDate(activeRange.start).getTime() - 86400000)));
      const closing = getAccountBalance(activeAccount, activeRange.end);
      const totalDebit = filteredEntries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0);
      const totalCredit = filteredEntries.reduce((s, e) => e.type === 'credit' ? s + e.amount : s, 0);

      // Sort for export as well
      const sortedForExport = [...filteredEntries].sort((a, b) => {
        const timeA = parseDate(a.date).getTime();
        const timeB = parseDate(b.date).getTime();
        return journalSort === 'desc' ? timeB - timeA : timeA - timeB;
      });

      const rows = sortedForExport.map(e => {
          const contra = activeCompany?.accounts.find(a => a.id === e.contraAccountId);
          const contraStr = contra ? `${contra.name} (${contra.code})` : 'External';
          const isNormalDebit = typeInfo?.normal === 'debit';
          return [
              `${e.date}\n${e.description}`,
              contraStr,
              e.type === 'debit' ? `${isNormalDebit ? '(+)' : '(-)'} ${formatCurrency(e.amount)}` : '-',
              e.type === 'credit' ? `${!isNormalDebit ? '(+)' : '(-)'} ${formatCurrency(e.amount)}` : '-',
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

    const opening = getAccountBalance(activeAccount, formatDate(new Date(parseDate(activeRange.start).getTime() - 86400000)));
    const closing = getAccountBalance(activeAccount, activeRange.end);
    const totalDebit = filteredEntries.reduce((s, e) => e.type === 'debit' ? s + e.amount : s, 0);
    const totalCredit = filteredEntries.reduce((s, e) => e.type === 'credit' ? s + e.amount : s, 0);

    const sortedEntries = [...filteredEntries].sort((a, b) => {
        const timeA = parseDate(a.date).getTime();
        const timeB = parseDate(b.date).getTime();
        return journalSort === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return (
      <div className="pt-1 pb-20 px-4 max-w-4xl mx-auto space-y-4 animate-slide-up">
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
                onClick={openNewEntryModal}
                className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 items-center h-10">
            <div className="relative flex-1 h-full group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-blue-500 transition-colors" size={12} />
              <input 
                type="text" 
                placeholder="Search transactions, reference or amount..." 
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                className="w-full h-full bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-8 pr-10 text-[10px] font-bold outline-none focus:border-blue-500/50 transition-all text-[var(--text-bright)] placeholder:text-[var(--muted)]/50"
              />
              {journalSearch && (
                <button 
                  onClick={() => setJournalSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-red-400 transition-colors"
                  title="Clear Search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <DateFilter range={rangeType} setRange={setRangeType} custom={customRange} setCustom={setCustomRange} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-[var(--muted)]">Opening</p>
            <p className="text-xs font-bold text-[var(--text-bright)] truncate">{formatCurrency(opening)}</p>
          </div>
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-teal-400">Debit (+)</p>
            <p className="text-xs font-bold text-[var(--text-bright)] truncate">{formatCurrency(totalDebit)}</p>
          </div>
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
            <p className="text-[8px] font-black text-orange-400">Credit (-)</p>
            <p className="text-xs font-bold text-[var(--text-bright)] truncate">{formatCurrency(totalCredit)}</p>
          </div>
          <div className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl border-blue-500/20 bg-blue-500/5 shadow-sm">
            <p className="text-[8px] font-black text-blue-400">Closing</p>
            <p className="text-xs font-black text-[var(--text-bright)] truncate">{formatCurrency(closing)}</p>
          </div>
        </div>

        <div className="space-y-3">
          {sortedEntries.map(entry => {
            const contra = activeCompany?.accounts.find(a => a.id === entry.contraAccountId);
            return (
              <div 
                key={entry.id} 
                className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)] relative z-0 hover:z-30 focus-within:z-30 active:scale-[0.99] transition-all cursor-pointer hover:border-blue-500/30"
                onClick={() => handleEditTransaction(entry.transactionId)}
              >
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-[var(--muted)] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--border)] uppercase">{entry.date}</span>
                    {entry.reference && <span className="text-[9px] font-black text-blue-400 border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 rounded uppercase">{entry.reference}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-[var(--muted)] tracking-tighter uppercase">Balance: {formatCurrency(entry.runningBalance)}</span>
                    <EllipsisMenu options={[
                      { label: 'Edit', icon: Edit3, onClick: () => handleEditTransaction(entry.transactionId) },
                      { label: 'Reverse Entry', icon: ArrowUpDown, onClick: () => handleCreateReversal(entry.transactionId) },
                      { label: 'Delete', icon: Trash2, onClick: () => { setTransactionToDelete(entry.transactionId); setShowModal('delete_confirm'); }, danger: true }
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
                    {(() => {
                      const isPositiveEffect = entry.type === typeInfo?.normal;
                      return (
                        <p className={`text-sm font-black ${isPositiveEffect ? 'text-teal-400' : 'text-orange-400'}`}>
                          {isPositiveEffect ? '+' : '-'}{formatCurrency(entry.amount)}
                        </p>
                      );
                    })()}
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
      <AnimatePresence mode="wait">
        {showModal === 'new_company' && (
          <Modal key="modal_new_company" title="Setup Business" confirmText="Create Company" onConfirm={handleCreateCompany} onClose={() => setShowModal(null)}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[var(--muted)] uppercase">Business Name</label>
                <input 
                  autoFocus 
                  type="text" 
                  placeholder="e.g. Acme Corp" 
                  value={formData.name || ""} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-[var(--muted)] uppercase">Currency</label>
                  <select 
                    value={formData.currency || "PKR"} 
                    onChange={e => setFormData({...formData, currency: e.target.value})}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]"
                  >
                    <option value="PKR">PKR (₨)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-[var(--muted)] uppercase text-left block">4-Digit PIN</label>
                   <input 
                    type="password" 
                    maxLength={4}
                    placeholder="0000 (Optional)"
                    value={formData.pin || ""} 
                    onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} 
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 tracking-[1em] text-center" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[var(--muted)] uppercase">Industry</label>
                <input type="text" placeholder="e.g. Retail" value={formData.industry || ""} onChange={e => setFormData({...formData, industry: e.target.value})} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]" />
              </div>
              
              <div className="pt-4 border-t border-[var(--border)] text-center space-y-2">
                <p className="text-[10px] font-bold uppercase text-[var(--muted)] tracking-wider">Or restore from existing</p>
                <label className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl cursor-pointer transition-all text-xs tracking-wider uppercase select-none shadow-lg shadow-purple-500/20 active:scale-95 w-full">
                  <Upload size={14} /> Import Backup File
                  <input type="file" accept=".json" onChange={(e) => { importData(e); setShowModal(null); }} className="hidden" />
                </label>
              </div>
            </div>
          </Modal>
        )}

        {showModal === 'edit_company' && (
          <Modal key="modal_edit_company" title="Edit Business" confirmText="Save Changes" onConfirm={handleUpdateCompany} onClose={() => setShowModal(null)}>
             <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[var(--muted)] uppercase">Business Name</label>
                <input 
                  type="text" 
                  value={formData.name || ""} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]"
                  placeholder="Company Name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-[var(--muted)] uppercase">Currency</label>
                  <select 
                    value={formData.currency || "PKR"} 
                    onChange={e => setFormData({...formData, currency: e.target.value})}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]"
                  >
                    <option value="PKR">PKR (₨)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-[var(--muted)] uppercase text-left block">4-Digit PIN</label>
                   <input 
                    type="password" 
                    maxLength={4}
                    placeholder="0000"
                    value={formData.pin || ""} 
                    onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} 
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 tracking-[1em] text-center" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[var(--muted)] uppercase">Industry</label>
                <input 
                  type="text" 
                  value={formData.industry || ""} 
                  onChange={e => setFormData({...formData, industry: e.target.value})}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]"
                  placeholder="Industry"
                />
              </div>
            </div>
          </Modal>
        )}

        {(showModal === 'new_account' || showModal === 'edit_account') && (
          <Modal key="modal_account" title={showModal === 'new_account' ? "New Account" : "Edit Account"} onConfirm={showModal === 'new_account' ? handleCreateAccount : handleUpdateAccount} onClose={() => setShowModal(null)}>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_TYPES.map(t => (
                  <button 
                    key={t.value}
                    onClick={() => {
                        const prefixes: Record<string, string> = { asset: '1', liability: '2', equity: '3', revenue: '4', expense: '5' };
                        const prefix = prefixes[t.value];
                        let code = formData.code || "";
                        if (!code && prefix) {
                          const existing = (activeCompany?.accounts || [])
                            .filter(a => a.type === t.value)
                            .map(a => parseInt(a.code))
                            .filter(c => !isNaN(c));
                          const nextNum = existing.length > 0 ? Math.max(...existing) + 1 : parseInt(prefix + "001");
                          code = nextNum.toString();
                        }
                        setFormData({ ...formData, type: t.value, code });
                    }}
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
          <JournalEntryModal 
            key="modal_multiline_entry"
            isOpen={true}
            onClose={() => setShowModal(null)}
            formData={formData}
            setFormData={setFormData}
            activeCompany={activeCompany}
            onSave={handleSaveEntry}
            setPreviousModal={setPreviousModal}
            setShowModal={setShowModal}
            formatCurrency={formatCurrency}
          />
        )}

        {(showModal === 'new_entry_single' || showModal === 'edit_entry_single') && (
          <SingleEntryModal 
            key="modal_single_entry"
            isOpen={true}
            onClose={() => setShowModal(null)}
            formData={formData}
            setFormData={setFormData}
            activeCompany={activeCompany}
            onSave={handleSaveEntry}
            setPreviousModal={setPreviousModal}
            setShowModal={setShowModal}
            formatCurrency={formatCurrency}
          />
        )}

        {showModal === 'entry_type_choice' && (
          <Modal key="modal_choice" title="Choose Entry Type" onClose={() => setShowModal(null)} onConfirm={() => setShowModal(null)} confirmText="Select below">
              <div className="grid grid-cols-1 gap-3">
                <button 
                  key="choice_standard"
                  onClick={() => {
                    const initialDate = data.lastUsedDate || formatDate(new Date());
                    setFormData({ date: initialDate, debitAccountId: activeAccount?.id.toString() || '', creditAccountId: '' });
                    setShowModal('new_entry_single');
                  }}
                  className="flex items-center gap-4 p-5 bg-[var(--surface)] hover:bg-[var(--border)] border border-[var(--border)] rounded-2xl transition-all group text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ArrowUpDown size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[var(--text-bright)]">Standard Ledger Entry</h4>
                    <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-tight">Double Entry (One Dr, One Cr)</p>
                  </div>
                </button>
                <button 
                  key="choice_split"
                  onClick={() => {
                    const initialDate = data.lastUsedDate || formatDate(new Date());
                    setFormData({ date: initialDate, items: [] });
                    setShowModal('new_entry');
                  }}
                  className="flex items-center gap-4 p-5 bg-[var(--surface)] hover:bg-[var(--border)] border border-[var(--border)] rounded-2xl transition-all group text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <LayoutDashboard size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[var(--text-bright)]">Multiline / Split Entry</h4>
                    <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-tight">Advance Peachtree Style (Multiple Dr/Cr)</p>
                  </div>
                </button>
              </div>
            </Modal>
          )}

        {showModal === 'settings' && (
          <Modal 
            title="Settings" 
            onClose={() => setShowModal(null)}
            onConfirm={() => setShowModal(null)}
            confirmText="Done"
          >
            <div className="space-y-6">
              {/* Dark Mode */}
              <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[var(--text-bright)]">Dark Mode</span>
                    <p className="text-[9px] text-[var(--muted)] font-bold uppercase truncate">Toggle Appearance</p>
                  </div>
                </div>
                <button 
                  onClick={toggleTheme}
                  className={`w-12 h-6 rounded-full transition-all relative ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-400'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {/* Data Sync */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black tracking-widest text-[var(--muted)] uppercase px-1">Data Sync</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={exportData}
                    className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex flex-col items-center gap-2 hover:bg-[var(--border)] transition-all shadow-sm"
                  >
                    <Download size={20} className="text-blue-500" />
                    <span className="text-[10px] font-black uppercase">Export Data</span>
                  </button>
                  <label className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex flex-col items-center gap-2 hover:bg-[var(--border)] transition-all cursor-pointer shadow-sm">
                    <Upload size={20} className="text-purple-500" />
                    <span className="text-[10px] font-black uppercase">Import Data</span>
                    <input type="file" accept=".json" onChange={importData} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Active Company */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black tracking-widest text-[var(--muted)] uppercase px-1">Active Company</h4>
                <div className="space-y-3">
                  <div className="relative">
                    <select 
                      value={selectedCompanyId || ""} 
                      onChange={(e) => { 
                          const id = parseInt(e.target.value);
                          setSelectedCompanyId(id); 
                          localStorage.setItem(ACTIVE_COMPANY_KEY, e.target.value);
                          const comp = data.companies.find(c => c.id === id);
                          if (comp?.pin) {
                              setIsUnlocked(false);
                          } else {
                              setIsUnlocked(true);
                          }
                      }}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 font-bold outline-none focus:border-blue-500/50 appearance-none text-sm text-[var(--text-bright)]"
                    >
                      <option value="">Select Company...</option>
                      {data.companies.map(c => <option key={`settings_opt_${c.id}`} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[var(--muted)] pointer-events-none" />
                  </div>
                  <button 
                    onClick={() => { setView('companies'); setShowModal(null); }}
                    className="w-full flex items-center justify-center gap-2 text-xs font-normal text-blue-500 py-2.5 bg-blue-500/5 border border-blue-500/10 rounded-xl hover:bg-blue-500/10 transition-all"
                  >
                    <Building2 size={14} /> Manage All Businesses
                  </button>
                </div>
              </div>

              {/* Factory Reset */}
              <div className="pt-4 border-t border-[var(--border)]">
                <button 
                  onClick={() => {
                    setFormData({});
                    setShowModal('factory_reset_confirm');
                  }}
                  className="w-full py-2 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-sm shadow-red-500/5"
                >
                  Delete All Databases
                </button>
              </div>
            </div>
          </Modal>
        )}
        {showModal === 'delete_company_confirm' && companyToDelete && (
          <Modal 
            key="modal_delete_company" 
            title="Delete Business" 
            confirmText="Permanently Delete" 
            onConfirm={() => {
              if (companyToDelete.pin) {
                if (formData.pinConfirm !== companyToDelete.pin) {
                  return notify("Invalid security PIN", "error");
                }
              }
              const compName = companyToDelete.name;
              setData(prev => ({ ...prev, companies: prev.companies.filter(c => c.id !== companyToDelete.id) }));
              if (selectedCompanyId === companyToDelete.id) {
                setSelectedCompanyId(null);
                setView('companies');
              }
              setCompanyToDelete(null);
              setShowModal(null);
              setFormData({});
              notify(`Business "${compName}" deleted`, "error");
            }} 
            onClose={() => { setCompanyToDelete(null); setShowModal(null); setFormData({}); }}
          >
             <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                  <Trash2 size={32} />
                </div>
                <div>
                  <h4 className="font-bold text-base text-[var(--text-bright)]">Confirm Deletion</h4>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Are you sure you want to delete <span className="text-red-500 font-bold">"{companyToDelete.name}"</span>?
                  </p>
                  <p className="text-[10px] text-red-400 font-medium tracking-wide uppercase mt-1">
                    This action is final and will erase all associated financial journals & ledger accounts.
                  </p>
                </div>

                {companyToDelete.pin && (
                  <div className="space-y-1.5 text-left max-w-xs mx-auto pt-2">
                    <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block">
                      Enter Company PIN to Authorize Deletion
                    </label>
                    <input 
                      type="password" 
                      maxLength={4}
                      placeholder="Enter 4-digit PIN"
                      value={formData.pinConfirm || ""}
                      onChange={e => setFormData({...formData, pinConfirm: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-[var(--surface)] text-[var(--text-bright)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-center text-sm font-black tracking-widest outline-none focus:border-red-500/50 transition-all placeholder:text-xs placeholder:font-normal placeholder:tracking-normal text-center"
                    />
                  </div>
                )}
             </div>
          </Modal>
        )}
        {showModal === 'factory_reset_confirm' && (
          <Modal 
            key="modal_factory_reset" 
            title="Delete All Databases" 
            confirmText="Permanently Reset" 
            onConfirm={async () => {
              if (activeCompany?.pin) {
                if (formData.pinConfirm !== activeCompany.pin) {
                  return notify("Invalid security PIN", "error");
                }
              }
              localStorage.clear();
              try {
                const req = indexedDB.deleteDatabase(DB_NAME);
                req.onsuccess = () => {
                  window.location.reload();
                };
                req.onerror = () => {
                  window.location.reload();
                };
                req.onblocked = () => {
                  window.location.reload();
                };
              } catch {
                window.location.reload();
              }
            }} 
            onClose={() => { setShowModal(null); setFormData({}); }}
          >
             <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                  <AlertCircle size={32} />
                </div>
                <div>
                  <h4 className="font-bold text-base text-[var(--text-bright)]">System Reset Confirmation</h4>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    This will permanently drop the database and remove all business ledgers, journals, and credentials.
                  </p>
                  <p className="text-[10px] text-red-400 font-medium tracking-wide uppercase mt-1">
                    This action is absolutely irreversible.
                  </p>
                </div>

                {activeCompany?.pin && (
                  <div className="space-y-1.5 text-left max-w-xs mx-auto pt-2">
                    <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider block">
                      Enter Currently Opened Company PIN to Authorize Reset
                    </label>
                    <input 
                      type="password" 
                      maxLength={4}
                      placeholder="Enter 4-digit PIN"
                      value={formData.pinConfirm || ""}
                      onChange={e => setFormData({...formData, pinConfirm: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-[var(--surface)] text-[var(--text-bright)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-center text-sm font-black tracking-widest outline-none focus:border-red-500/50 transition-all placeholder:text-xs placeholder:font-normal placeholder:tracking-normal text-center"
                    />
                  </div>
                )}
             </div>
          </Modal>
        )}
        {showModal === 'delete_confirm_account' && (
          <Modal 
            key="modal_delete_account" 
            title="Delete Account" 
            confirmText="Permanently Delete" 
            onConfirm={confirmDeleteAccount} 
            onClose={() => { setAccountToDelete(null); setShowModal(null); setFormData({}); }}
          >
             <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                  <Trash2 size={32} />
                </div>
                <div className="space-y-1">
                   <p className="text-sm font-bold text-[var(--text-bright)]">Delete this account?</p>
                   <p className="text-[10px] text-[var(--muted)] uppercase font-black">This account will be removed from your chart of accounts.</p>
                </div>

                {activeCompany?.pin && (
                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <label className="text-[10px] font-black text-[var(--muted)] uppercase block text-left">Confirm Security PIN</label>
                    <input 
                      type="password" 
                      maxLength={4}
                      autoFocus
                      placeholder="Enter PIN"
                      value={formData.pinConfirm || ""}
                      onChange={e => setFormData({...formData, pinConfirm: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-center tracking-[1em] font-black outline-none focus:border-red-500/50"
                    />
                  </div>
                )}
             </div>
          </Modal>
        )}
        {showModal === 'delete_confirm' && (
          <Modal 
            key="modal_delete" 
            title="Delete Transaction" 
            confirmText="Permanently Delete" 
            onConfirm={() => handleDeleteTransaction(transactionToDelete!)} 
            onClose={() => { setTransactionToDelete(null); setShowModal(null); setFormData({}); }}
          >
             <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                  <Trash2 size={32} />
                </div>
                <div className="space-y-1">
                   <p className="text-sm font-bold text-[var(--text-bright)]">Are you absolutely sure?</p>
                   <p className="text-[10px] text-[var(--muted)] uppercase font-black">This will wipe the transaction from ALL involved accounts.</p>
                </div>
                
                {activeCompany?.pin && (
                  <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                    <label className="text-[10px] font-black text-[var(--muted)] uppercase block text-left">Confirm Security PIN</label>
                    <input 
                      type="password" 
                      maxLength={4}
                      autoFocus
                      placeholder="Enter PIN"
                      value={formData.pinConfirm || ""}
                      onChange={e => setFormData({...formData, pinConfirm: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-center tracking-[1em] font-black outline-none focus:border-red-500/50"
                    />
                  </div>
                )}
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
    a.download = `ledgerpro_backup_${formatDate(new Date())}.json`;
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
          setView('companies');
          setSelectedCompanyId(null);
          setIsUnlocked(false);
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
  const openNewEntryModal = () => {
    setShowModal('entry_type_choice');
  };

  if (!isLoaded) return <div className="h-screen flex items-center justify-center bg-[var(--bg)] font-black text-xl animate-pulse">LEDGERPRO</div>;

  return (
    <div className="relative min-h-screen pb-20 native-scroll">
      
      {/* PIN Lock Overlay */}
      {!isUnlocked && selectedCompanyId && activeCompany?.pin && (
        <LockScreen 
          company={activeCompany} 
          onUnlock={(pin) => { 
            setIsUnlocked(true); 
            setEnteredPin(pin);
            setView('dashboard');
          }} 
          onBack={() => {
            setSelectedCompanyId(null);
            setIsUnlocked(true);
          }}
        />
      )}

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
          {!activeCompany && (
            <button 
              onClick={() => setShowModal('settings')}
              className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--text-bright)] transition-colors flex items-center gap-1.5"
              title="Settings & System Tools"
            >
              <Settings size={16} />
              <span className="text-[10px] font-black uppercase hidden sm:inline">Settings</span>
            </button>
          )}
          {activeCompany && (
            <button 
              onClick={() => { setView('companies'); setSelectedCompanyId(null); setIsUnlocked(true); }}
              className="p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--text-bright)] transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft size={16} />
              <span className="text-[10px] font-black uppercase hidden sm:inline">Back</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-10">
        {view === 'companies' && renderCompanies()}
        {view === 'dashboard' && renderDashboard()}
        {view === 'accounts' && renderAccounts()}
        {view === 'journal' && renderJournal()}
        {view === 'reports' && (
          <FinancialReports 
            activeCompany={activeCompany} 
            rangeType={rangeType} 
            setRangeType={setRangeType} 
            customRange={customRange} 
            setCustomRange={setCustomRange} 
            formatCurrency={formatCurrency} 
            activeRange={activeRange} 
            getAccountBalance={getAccountBalance} 
            exportToPDF={exportToPDF}
            notify={notify}
          />
        )}
      </main>

      {/* Mobile Navigation */}
      {activeCompany && isUnlocked && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card)]/90 backdrop-blur-xl border-t border-[var(--border)] pb-safe shadow-2xl">
          <div className="flex justify-around items-center h-16 px-4 max-w-lg mx-auto relative group gap-1">
             <button 
               onClick={() => setView('dashboard')} 
               className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-all outline-none select-none ${
                 view === 'dashboard' 
                   ? 'text-blue-400 bg-blue-500/10 font-black scale-105' 
                   : 'text-[var(--muted)] hover:text-white'
               }`}
             >
                <Activity size={18} />
                <span className="text-[8px] font-black uppercase tracking-tighter">Live</span>
             </button>
             
             <button 
               onClick={() => setView('accounts')} 
               className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-all outline-none select-none ${
                 view === 'accounts' || view === 'journal'
                   ? 'text-blue-400 bg-blue-500/10 font-black scale-105' 
                   : 'text-[var(--muted)] hover:text-white'
               }`}
             >
                <Briefcase size={18} />
                <span className="text-[8px] font-black uppercase tracking-tighter">Accounts</span>
             </button>
             
             {/* Center Plus Button */}
             <div className="relative -top-4 shrink-0 mx-1">
                <button 
                  onClick={openNewEntryModal}
                  className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/40 relative z-10 active:scale-90 transition-transform"
                >
                  <Plus size={24} />
                </button>
                <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 -z-10" />
             </div>

             <button 
               onClick={() => setView('reports')} 
               className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-all outline-none select-none ${
                 view === 'reports' 
                   ? 'text-blue-400 bg-blue-500/10 font-black scale-105' 
                   : 'text-[var(--muted)] hover:text-white'
               }`}
             >
                <FileText size={18} />
                <span className="text-[8px] font-black uppercase tracking-tighter">Reports</span>
             </button>

             <button 
               onClick={() => setShowModal('settings')} 
               className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center gap-0.5 transition-all outline-none select-none ${
                 showModal === 'settings' 
                   ? 'text-blue-400 bg-blue-500/10 font-black scale-105' 
                   : 'text-[var(--muted)] hover:text-white'
               }`}
             >
                <Settings size={18} />
                <span className="text-[8px] font-black uppercase tracking-tighter">Settings</span>
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
