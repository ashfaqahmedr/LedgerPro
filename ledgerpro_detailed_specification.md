# LedgerPro — Detailed Specification
**Version:** 2.0 — Native Android Edition  
**Last Updated:** 2026-05-25  
**Stack:** React 19 + TypeScript + Vite + Capacitor 8 (Android Native)

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Design System & Color Palette](#4-design-system--color-palette)
5. [Typography System](#5-typography-system)
6. [Layout & Spacing Patterns](#6-layout--spacing-patterns)
7. [CSS Utility Classes & Animations](#7-css-utility-classes--animations)
8. [Data Models (TypeScript Interfaces)](#8-data-models-typescript-interfaces)
9. [Application State](#9-application-state)
10. [Navigation & Views](#10-navigation--views)
11. [Shared / Reusable Components](#11-shared--reusable-components)
12. [View Specifications](#12-view-specifications)
13. [Modal Specifications](#13-modal-specifications)
14. [Native Android Integration](#14-native-android-integration)
15. [PDF Export System](#15-pdf-export-system)
16. [Data Persistence](#16-data-persistence)
17. [Toast Notification System](#17-toast-notification-system)
18. [Business Logic & Accounting Engine](#18-business-logic--accounting-engine)
19. [UI Interaction Patterns](#19-ui-interaction-patterns)
20. [File Structure](#20-file-structure)

---

## 1. Project Overview

LedgerPro is a **local-first, offline-capable accounting app** for small businesses. It is built as a PWA and packaged as a native Android app via Capacitor. All financial data is stored entirely on-device using IndexedDB — no server, no cloud sync.

### Core Features
- Multi-company management with PIN protection
- Double-entry bookkeeping (Standard + Multiline entries)
- Chart of Accounts with journal ledgers
- Financial Reports: P&L, Balance Sheet, Trial Balance
- PDF export (save to device or share via Android intent)
- JSON backup / restore (import/export)
- Dark / Light theme toggle
- Native Android: haptics, status bar, back button, splash screen, auto-backup

---

## 2. Technology Stack

### Core
| Package | Version | Purpose |
|---|---|---|
| `react` | 19.0.1 | UI framework |
| `typescript` | ~5.8.2 | Static typing |
| `vite` | 6.2.3 | Build tool |
| `vite-plugin-pwa` | 1.3.0 | PWA service worker |
| `@vitejs/plugin-react` | 5.0.4 | React fast refresh |

### UI & Styling
| Package | Version | Purpose |
|---|---|---|
| `tailwindcss` | 4.1.14 | Utility-first CSS (Vite plugin mode) |
| `@tailwindcss/vite` | 4.1.14 | Tailwind Vite integration |
| `motion` | 12.23.24 | Animations (AnimatePresence, motion.div) |
| `lucide-react` | 0.546.0 | Icon library |
| `recharts` | 3.8.1 | Chart components |

### Business Logic
| Package | Version | Purpose |
|---|---|---|
| `jspdf` | 4.2.1 | PDF generation |
| `jspdf-autotable` | 5.0.8 | PDF table rendering |

### Native (Capacitor)
| Package | Version | Purpose |
|---|---|---|
| `@capacitor/core` | 8.3.4 | Capacitor runtime |
| `@capacitor/android` | 8.3.4 | Android platform |
| `@capacitor/cli` | 8.3.4 | Build CLI |
| `@capacitor/app` | 8.1.0 | Back button, app state |
| `@capacitor/haptics` | 8.0.2 | Vibration feedback |
| `@capacitor/keyboard` | 8.0.3 | Keyboard resize control |
| `@capacitor/splash-screen` | 8.0.1 | Splash screen API |
| `@capacitor/status-bar` | 8.0.2 | Status bar color/style |
| `@capacitor/filesystem` | 8.1.2 | File read/write (Documents, Cache) |
| `@capacitor/share` | 8.0.1 | Android share intent |

### Dev Dependencies
| Package | Purpose |
|---|---|
| `@capacitor/assets` | Icon/splash generation |
| `autoprefixer` | CSS autoprefixer |
| `ftp-deploy` | Deployment script |
| `tsx` | TypeScript execution |

### NPM Scripts
```bash
npm run dev          # Vite dev server on port 3000 (all hosts)
npm run build        # Production Vite build → dist/
npm run lint         # TypeScript type check (tsc --noEmit)
npm run cap:sync     # npx cap sync (all platforms)
npm run cap:open:android  # Open Android Studio
npm run mobile:build # build + cap sync in one command
npm run deploy       # node deploy.js (FTP deploy)
```

---

## 3. Architecture

### File Layout
```
f:/ledgerpro/
├── src/
│   ├── App.tsx          # ENTIRE app — 4,004 lines, single-file architecture
│   ├── index.css        # Design system CSS + Tailwind theme
│   └── main.tsx         # React root mount
├── android/             # Capacitor Android project
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       ├── java/…/MainActivity.java
│       └── res/values/
│           ├── styles.xml
│           └── strings.xml
├── public/              # Static assets, icons, manifest
├── dist/                # Production build output (gitignored)
├── capacitor.config.ts  # Capacitor plugin + Android config
├── vite.config.ts       # Vite + PWA + Tailwind config
├── package.json
└── ledgerpro_detailed_specification.md
```

### Single-File Pattern
The entire UI logic, components, modals, views, and state lives in `src/App.tsx`. This is intentional — it avoids prop-drilling complexity across files and makes the app easy to ship as a single Capacitor WebView. All sub-components are defined at module level (outside `App`) to prevent re-mounting.

### Rendering Pipeline
```
main.tsx
  └── <App />                     ← Root component (App.tsx:1418)
        ├── State initialization  ← IndexedDB + localStorage
        ├── Native setup effects  ← Capacitor plugins
        ├── <LockScreen />        ← Overlay (z-200) if PIN not entered
        ├── <header />            ← Glass header (sticky, safe area aware)
        ├── <main />              ← Active view renderer
        │   ├── renderCompanies()
        │   ├── renderDashboard()
        │   ├── renderAccounts()
        │   ├── renderJournal()
        │   ├── <FinancialReports />
        │   └── renderBalanceSheet() [legacy, accessible via nav]
        ├── <nav />               ← Bottom navigation (5 tabs + center FAB)
        ├── {renderModals()}      ← AnimatePresence modal stack (z-100)
        └── Toast notification    ← AnimatePresence (z-200, bottom-24)
```

---

## 4. Design System & Color Palette

### Dark Mode (Default) — CSS Custom Properties
```css
:root {
  --bg:           #000000;   /* Pure black — page background */
  --surface:      #121214;   /* Slightly elevated — cards, inputs */
  --card:         #18181B;   /* Elevated card surface */
  --border:       #27272A;   /* Subtle borders */
  --muted:        #71717A;   /* Secondary text, labels, icons */
  --text:         #A1A1AA;   /* Body text */
  --text-bright:  #FFFFFF;   /* Primary text, headings */
  --primary:      #3B82F6;   /* Blue 500 — CTAs, active states */
  --primary-light:#6366F1;   /* Indigo 500 — gradient partner */
  --success:      #10B981;   /* Emerald 500 — success, profit, debit credit on assets */
  --warning:      #F59E0B;   /* Amber 500 — warnings */
  --danger:       #EF4444;   /* Red 500 — errors, deletions */
}
```

### Light Mode — CSS Custom Properties
```css
[data-theme="light"] {
  --bg:           #F4F4F5;   /* Zinc 100 */
  --surface:      #FFFFFF;   /* White */
  --card:         #FAFAFA;   /* Near-white */
  --border:       #E4E4E7;   /* Zinc 200 */
  --muted:        #71717A;   /* Zinc 500 (same) */
  --text:         #3F3F46;   /* Zinc 700 */
  --text-bright:  #09090B;   /* Near-black */
  --primary:      #2563EB;   /* Blue 600 */
  --primary-light:#4F46E5;   /* Indigo 600 */
  --success:      #059669;   /* Emerald 600 */
  --warning:      #D97706;   /* Amber 600 */
  --danger:       #DC2626;   /* Red 600 */
}
```

### Semantic Color Usage
| Color | Hex (dark) | Used For |
|---|---|---|
| Blue | `#3B82F6` | Primary actions, active nav, FAB, focus rings |
| Purple | `#6366F1` | Gradient partner, import buttons, advanced features |
| Teal/Emerald | `#10B981` | Debit (+), profit, assets, success states |
| Orange | `#F97316` | Credit (-), expenses, warning tone |
| Red | `#EF4444` | Danger, delete, error, net loss |
| Blue-gray | opacity variants | Balanced pill, info badges |
| Chart palette | `['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899']` | Recharts Pie segments |

### Android-Specific Colors
```
Splash screen background: #111827 (Gray 900)
Status bar: Transparent (#00000000)
Navigation bar: Transparent (#00000000)
Android colorPrimary: #3B82F6
Android colorPrimaryDark: #111827
```

### Tailwind Theme Extension (in `@theme {}`)
```css
--color-primary: #3B82F6
--color-primary-light: #6366F1
--color-accent: #f97316
--color-bg: #000000
--color-surface: #121214
--color-card: #18181B
--color-border: #27272A
--color-success: #10B981
--color-warning: #F59E0B
--color-danger: #EF4444
```

---

## 5. Typography System

### Font Families
```css
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
```
- **Inter** — loaded from Google Fonts (weights: 400, 500, 600, 700, 800, 900)
- **JetBrains Mono** — for currency values, balances, codes (weights: 400, 500)

### Type Scale Used in App
| Class | Size | Weight | Used For |
|---|---|---|---|
| `text-2xl font-bold` | 24px | 700 | Section headings (Businesses, Chart of Accounts) |
| `text-xl font-bold` | 20px | 700 | Sub-section headings |
| `text-lg font-bold` | 18px | 700 | Card titles |
| `text-base font-bold` | 16px | 700 | Company names, modal titles |
| `text-sm font-bold` | 14px | 700 | Entry descriptions, account names |
| `text-sm font-semibold` | 14px | 600 | Table cell content |
| `text-xs font-bold` | 12px | 700 | Body labels, button text |
| `text-[11px] font-bold` | 11px | 700 | Stat card values |
| `text-[10px] font-black` | 10px | 900 | Form labels (UPPERCASE), nav tabs |
| `text-[9px] font-black` | 9px | 900 | Tags, badges, sub-labels |
| `text-[8px] font-black` | 8px | 900 | Stat card labels (UPPERCASE) |
| `font-mono` | inherited | — | Currency values, codes |
| `tracking-widest` | — | — | Nav tab text, badge labels |
| `tracking-[1em]` | — | — | PIN input (monospace digit spacing) |

---

## 6. Layout & Spacing Patterns

### App Shell
```
Full height: position: fixed on html/body (Android edge-to-edge)
Scroll container: #root (overflow-y: auto, -webkit-overflow-scrolling: touch)
Content center: max-w-2xl mx-auto (640px desktop cap, full width mobile)
```

### Header
```
Class: glass-header
Position: sticky top-0 z-[60]
Height: calc(4rem + var(--sat))   ← 64px + status bar height
Padding-top: calc(0.75rem + var(--sat))
Background: var(--surface)/90 + backdrop-blur-xl
Border: border-b border-[var(--border)]
Content: LedgerPro logo left | action buttons right
```

### Bottom Navigation
```
Position: fixed bottom-0 left-0 right-0 z-50
Height: 64px (h-16) + padding-bottom: var(--sab)
Background: var(--card)/90 + backdrop-blur-xl
Border: border-t border-[var(--border)]
Layout: flex justify-around items-center
Tabs: 5 total (Live | Accounts | [FAB] | Reports | Settings)
FAB: -top-4 (floats above nav bar), 48px circle, blue-600, shadow-blue-500/40
```

### View Content Wrapper
```
Class on views: pt-1 pb-20 px-4
Top pad: 4px (header is sticky)
Bottom pad: 80px (above bottom nav)
Side pad: 16px
Animation: animate-slide-up on mount
```

### Modal Shell
```
Backdrop: fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm
Panel: w-full max-w-2xl h-full (full viewport on mobile)
  Header: px-3 border-b min-h-[44px] pt: calc(var(--sat) + 0.25rem)
  Body: p-3 space-y-3 overflow-y-auto native-scroll flex-1
  Footer: px-3 pt-2 pb: calc(var(--sab) + 0.5rem) bg-surface border-t
  Buttons: Cancel (flex-1 bordered) | Confirm (flex-1 bg-blue-600)
```

### Stat Card Grid (used in Dashboard, Accounts, Journal views)
```
Layout: grid grid-cols-2 sm:grid-cols-4 gap-2
Each card: p-2.5 bg-surface rounded-xl border shadow-sm
Label: text-[8px] font-black text-muted (UPPERCASE implied)
Value: text-[11px] font-bold text-bright truncate
Closing card special: border-blue-500/20 bg-blue-500/5
```

### List Item Card Pattern
```
Container: p-3 md:p-4 bg-surface rounded-xl md:rounded-2xl border border-border
Hover: hover:border-blue-500/30
Active: active:scale-[0.98] transition-all
Context menu: z-0 hover:z-30 focus-within:z-30 (z-index elevation on hover)
```

---

## 7. CSS Utility Classes & Animations

### Safe Area Utilities
```css
.pt-safe    { padding-top: var(--sat); }
.pb-safe    { padding-bottom: var(--sab); }
.pl-safe    { padding-left: var(--sal); }
.pr-safe    { padding-right: var(--sar); }
.mt-safe    { margin-top: var(--sat); }
.mb-safe    { margin-bottom: var(--sab); }
.inset-safe { padding: var(--sat) var(--sar) var(--sab) var(--sal); }
.h-screen-safe    { height: calc(100vh - var(--sat) - var(--sab)); }
.min-h-screen-safe{ min-height: calc(100vh - var(--sat) - var(--sab)); }
```

### Scroll Utilities
```css
.native-scroll {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  scroll-behavior: smooth;
}
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }
```

### Touch Utilities
```css
.touch-active { transition: opacity 0.1s, transform 0.1s; }
.touch-active:active { opacity: 0.7; transform: scale(0.97); }
```

### Component Presets
```css
.glass-header   — sticky header with safe-area top padding
.mobile-card    — rounded-2xl card with 48px min-height
.btn-primary    — gradient blue button, min-height 48px
.btn-secondary  — bordered grey button, min-height 48px
.bottom-nav     — fixed bottom nav with sab padding
.brand-gradient — bg-gradient blue → indigo
.bg-radial-gradient — radial blue glow for LockScreen
```

### Animations
```css
@keyframes slide-up      → translateY(20px→0) + opacity 0→1  [0.3s ease-out]
@keyframes slide-in-right→ translateX(30px→0) + opacity 0→1  [0.25s ease-out]
@keyframes fade-in       → opacity 0→1                        [0.2s ease-out]
@keyframes scale-in      → scale(0.95→1) + opacity 0→1        [0.2s ease-out]
@keyframes shake         → translateX oscillation ±6px         [0.4s ease-out]
```
Applied classes: `.animate-slide-up`, `.animate-slide-in`, `.animate-fade-in`, `.animate-scale-in`, `.animate-shake`

---

## 8. Data Models (TypeScript Interfaces)

### Entry
```typescript
interface Entry {
  id: number;              // Unique entry ID (global auto-increment)
  transactionId: number;   // Groups all entries from one transaction
  date: string;            // 'YYYY-MM-DD' format
  description: string;     // Narrative / memo
  type: 'debit' | 'credit';
  amount: number;          // Positive decimal
  reference: string;       // e.g. 'GJ-001', 'REV-GJ-001' for reversals
  contraAccountId: number; // ID of the other account in simple 2-line entries (-1 for multiline)
}
```

### Account
```typescript
interface Account {
  id: number;
  name: string;
  code: string;            // e.g. '1001', '2001' — auto-generated by type prefix
  type: AccountType;       // 'asset'|'liability'|'equity'|'revenue'|'expense'
  description: string;
  openingBalance: number;  // Balance before first entry
  entries: Entry[];
  createdAt: string;       // ISO 8601
}
```

### Company
```typescript
interface Company {
  id: number;
  name: string;
  industry: string;
  currency: string;        // 'PKR'|'USD'|'EUR'|'GBP'|'AED'
  pin?: string;            // Optional 4-digit string PIN for lock screen
  accounts: Account[];
  createdAt: string;
}
```

### AppData (IndexedDB Root)
```typescript
interface AppData {
  companies: Company[];
  nextId: number;          // Global monotonic ID counter for all entities
  lastUsedDate?: string;   // Pre-fills date in new entry modal
}
```

### InvoiceItem (reserved for future Invoice Generator)
```typescript
interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;          // quantity * rate
}
```

### Account Types Constant
```typescript
const ACCOUNT_TYPES = [
  { value: 'asset',     label: 'Asset',     category: 'Balance Sheet',     normal: 'debit' },
  { value: 'liability', label: 'Liability', category: 'Balance Sheet',     normal: 'credit' },
  { value: 'equity',    label: 'Equity',    category: 'Balance Sheet',     normal: 'credit' },
  { value: 'revenue',   label: 'Revenue',   category: 'Income Statement',  normal: 'credit' },
  { value: 'expense',   label: 'Expense',   category: 'Income Statement',  normal: 'debit' },
];
```

### Account Code Prefixes (Auto-Generated)
```
Asset       → prefix '1' → e.g. 1001, 1002
Liability   → prefix '2' → e.g. 2001
Equity      → prefix '3' → e.g. 3001
Revenue     → prefix '4' → e.g. 4001
Expense     → prefix '5' → e.g. 5001
```

---

## 9. Application State

### State Variables (in App component)
```typescript
// Data
data: AppData                    // All company/account/entry data
isLoaded: boolean                // IndexedDB load complete

// Theming
theme: 'dark' | 'light'

// Navigation
view: 'companies'|'dashboard'|'accounts'|'journal'|'reports'|'balanceSheet'
selectedCompanyId: number | null
selectedAccountId: number | null

// Modal system
showModal: string | null         // Active modal key string
previousModal: string | null     // Stack depth for new_account flow
formData: any                    // Shared form state across all modals

// UI feedback
toast: { msg: string; type: 'success'|'error' } | null

// Search/Sort/Filter
searchTerm: string               // Accounts view search
journalSearch: string            // Journal view search
dashboardSearch: string          // Dashboard transaction search
journalSort: 'desc'|'asc'
dashboardSort: 'desc'|'asc'
accountSort: 'name_asc'|'name_desc'|'code_asc'

// Date range
rangeType: DateRangeType
customRange: DateRange
activeRange: DateRange           // Computed from rangeType

// Security
isUnlocked: boolean
enteredPin: string               // Currently entered PIN (4 chars)

// Delete confirmation
transactionToDelete: number | null
accountToDelete: number | null
companyToDelete: Company | null

// Refresh key
refreshKey: number               // Triggers re-renders on demand
```

### Derived / Memoized Values
```typescript
activeCompany  = useMemo → data.companies.find(c => c.id === selectedCompanyId)
activeAccount  = useMemo → activeCompany?.accounts.find(a => a.id === selectedAccountId)
activeRange    = useMemo → getDatesForRange(rangeType, customRange)
```

---

## 10. Navigation & Views

### View Flow
```
companies (default)
  └─ click company (no PIN) → dashboard
  └─ click company (has PIN) → LockScreen overlay → dashboard
       ├─ accounts
       │    └─ click account → journal (renderJournal)
       ├─ reports (FinancialReports component)
       ├─ [legacy] balanceSheet (renderBalanceSheet)
       └─ settings modal
```

### Bottom Navigation Tabs
| Tab | Icon | View | Active When |
|---|---|---|---|
| Live | `Activity` | `dashboard` | view === 'dashboard' |
| Accounts | `Briefcase` | `accounts` | view === 'accounts' or 'journal' |
| **[FAB]** | `Plus` | opens `entry_type_choice` modal | always center |
| Reports | `FileText` | `reports` | view === 'reports' |
| Settings | `Settings` | shows `settings` modal | showModal === 'settings' |

FAB Behavior: Opens `entry_type_choice` modal → user picks Standard or Multiline

### Header Buttons (context-sensitive)
- **No company selected**: Shows `Settings` button
- **Company selected**: Shows `← Back` button → goes to companies view

### Android Back Button Navigation (native only)
```
showModal open   → close modal
view === journal → accounts
view === accounts|dashboard|balanceSheet → dashboard (first press), then companies (second press)
view === companies → CapApp.exitApp()
```

### Date Filter (`DateFilter` component)
Persistent across Dashboard, Accounts, Journal, Reports, Balance Sheet.
Options: All Time, Today, Yesterday, This Week, This Month, Last Month, This Year, Last Year, Custom Range

---

## 11. Shared / Reusable Components

### `Modal` (lines 247–291)
Full-height slide-in panel (mobile sheet pattern).
```
Props: title, children, onConfirm, confirmText, onClose, disabled, className, bodyClassName
Structure:
  Backdrop: fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm
  Panel: w-full max-w-2xl h-full bg-[var(--card)]
    Header: title + X close button (pt = calc(sat + 0.25rem))
    Body: children (scrollable, native-scroll)
    Footer: Cancel + Confirm buttons (pb = calc(sab + 0.5rem))
Animation: motion.div scale 0.98→1, opacity 0→1 (enter/exit)
```

### `EllipsisMenu` (lines 294–329)
Three-dot context menu for list items.
```
Props: options[{ label, icon, onClick, danger? }]
Trigger: MoreVertical icon button (18px), rounded-full, hover:bg-surface
Dropdown: absolute right-0 top-10, w-48, bg-card, border, rounded-xl, z-[110]
  Items: px-5 py-3.5, text-[10px] font-black uppercase tracking-widest
  Normal: text-[var(--text-bright)], icon: text-blue-500
  Danger: text-red-500, icon: text-red-500, hover:bg-red-500/10
  Separator: 0.4 opacity border between items
Backdrop: fixed inset-0 z-[100] to close on outside click
Animation: scale 0.95→1, opacity 0→1, y -10→0
```

### `SearchableSelect` (lines 331–405)
Searchable dropdown for account selection.
```
Props: label, value, onChange, options[{value,label}], placeholder, colorClass, onAddClick?
Trigger: w-full bg-surface border rounded-xl px-3 py-3 (click to open)
Dropdown: absolute top-[100%] mt-2 max-h-60, bg-card, border, rounded-xl, z-[120]
  Search bar: sticky, bg-surface, with Search icon
  Options: px-4 py-3, selected: bg-blue-500/10 text-blue-400
  "Add New Account" button: at bottom if onAddClick provided, blue, + icon
Animation: scale 0.95→1, y 5→0
Used In: SingleEntryModal (debit/credit selectors), JournalEntryModal line editor
```

### `DateFilter` (lines 407–469)
Compact date range picker dropdown.
```
Props: range, setRange, custom, setCustom
Trigger: flex items-center gap-2 px-4 py-2 bg-surface border rounded-xl
  Shows: Calendar icon (blue-500) + selected range label
Dropdown: absolute right-0 mt-2 w-48, bg-card, border, rounded-xl, z-[90]
  Options: DATE_RANGE_OPTIONS (9 options), active: text-blue-400 bg-blue-500/5
  Custom Range: adds Start + End date inputs below options
Animation: y 10→0, scale 0.95→1
```

### `LockScreen` (lines 471–544)
Full-screen PIN entry overlay.
```
Layout: fixed inset-0 z-[200] bg-[var(--bg)] flex flex-col items-center justify-center
Background: bg-radial-gradient (radial blue glow from top)
Content: max-w-xs text-center space-y-8
  Company icon: w-20 h-20 rounded-3xl bg-blue-500/10 border-blue-500/20, Lock icon (40px)
  Company name: text-2xl font-black
  PIN dots: 4 dots (w-4 h-4 rounded-full)
    Empty: border-[var(--border)]
    Filled: bg-blue-500 border-blue-500 scale-110 shadow-blue-500/30
    Error: border-red-500 bg-red-500 (all 4 flash red for 500ms)
  Numpad: grid grid-cols-3 gap-4
    Keys: 1-9, blank, 0, C
    Key style: w-16 h-16 rounded-2xl bg-surface border, text-xl font-black
    Active scale: active:scale-90
  Back link: text-xs muted, uppercase, ArrowLeft icon
Haptics: ImpactStyle.Light on each keypress, hapticSuccess() on correct, hapticError() on wrong
```

### `FinancialReports` (lines 547–893)
The Reports view component.
```
Sub-navigation: 3 tabs — P&L, Balance Sheet, Trial Balance
  Tab bar: flex bg-surface p-1.5 rounded-2xl border overflow-x-auto
  Active tab: bg-blue-600 text-white shadow-blue-500/20
  Inactive: text-muted hover:text-bright hover:bg-border
Header: title + period label + Save (Download) + Share buttons + DateFilter
```

**P&L Tab:**
```
Section: bg-surface rounded-3xl border, bg-gradient-to-r from-blue-600/5 to-purple-600/5 header
Operating Income block: line items + Gross Profit box (bg-bg, teal-400)
Operating Expenses block: line items + Total Expenses box (orange-400)
Net Income banner: teal (profit) or red (loss), 2-column with icon + amount + margin%
```

**Balance Sheet Tab:**
```
Assets card: bg-teal-500/5 header, account rows hover:bg-bg
Liabilities & Equity card: bg-orange-500/5 header
  Liabilities section
  Equity section + Retained Earnings (blue-500/10 bg)
```

**Trial Balance Tab:**
```
Table: rounded-3xl, divide-y rows
Columns: Account Description | Debit Balance | Credit Balance
Debit: text-teal-400 font-mono font-bold
Credit: text-orange-400 font-mono font-bold
Footer: Trial Totals row, border-t-2 teal/orange
```

---

## 12. View Specifications

### Companies View (`renderCompanies`)
```
Route: view === 'companies'
Header bar: "Workspace" label + "Businesses" h2
  Right buttons: Import Backup (purple) | New Business (blue)
Company cards: motion.div layoutId={company-${id}}
  Left: blue-to-purple gradient icon (Building2) + name + industry
  Right: EllipsisMenu (Edit, Delete) + ChevronRight
  Click: select company → check PIN → dashboard or LockScreen
Empty state: Building2 icon (w-20 h-20) + message + Add/Import buttons
```

### Dashboard View (`renderDashboard`)
```
Route: view === 'dashboard'
PIN alert: orange banner if no PIN set — "Secure Now" button
Header: company name + Save + Share + DateFilter
Stat grid: Opening | Debit (+) | Credit (-) | Closing
  Closing card: blue tinted (bg-blue-500/5 border-blue-500/20)
Search bar: full-width with Search icon + X clear
Sort toggle: ArrowUpDown button (Newest/Oldest)
Transaction feed: all entries filtered by date range + search
  Entry card: date badge + reference badge | description + contra account | ±amount
    Amount: teal for normal (+), orange for abnormal (-)
    EllipsisMenu: Edit | Reverse Entry | Delete
    Click card: opens edit modal (edit_entry)
Empty: dashed border card "No entries yet"
```

### Accounts View (`renderAccounts`)
```
Route: view === 'accounts'
Title: "Directory" + "Chart of Accounts"
Stat grid: Opening | Debit | Credit | Closing (same pattern as dashboard)
Toolbar (sticky top-14 z-20): Search | Sort | Download | Share | + Add
Account list: name + (code • type) + balance + EllipsisMenu
  Balance: red if negative
  EllipsisMenu: Journal | Edit | Delete
  Click: goes to journal view
Empty: handled by filtered list being empty
```

### Journal View (`renderJournal`)
```
Route: view === 'journal' (requires selectedAccountId)
Back button: ArrowLeft → accounts view
Title: account name + "Ledger • {code}"
Action buttons: Sort toggle | Download | Share | + Add
Search bar + DateFilter
Stat grid: Opening | Debit (+) | Credit (-) | Closing
Entry list: sorted by date
  Entry card: date + reference | running balance top-right | description + contra + txId | ±amount
  EllipsisMenu: Edit | Reverse Entry | Delete
  Click: opens edit modal
Empty: "No transactions for this period."
```

### Reports View (via `FinancialReports` component)
```
Route: view === 'reports'
See FinancialReports component spec above
```

### Balance Sheet View (`renderBalanceSheet`)
```
Route: view === 'balanceSheet' [used for legacy navigation only]
Balance status banner: teal (balanced) or red (unbalanced)
Assets section: list + total
Liabilities section: list + total
Equity section: Opening Equity + Net Income (period) card
```

---

## 13. Modal Specifications

All modals use `AnimatePresence mode="wait"` for enter/exit animations.
All destructive modals PIN-protect when `activeCompany.pin` is set.
Modal keys are string literals stored in `showModal` state.

### `new_company` — Setup Business
```
Key: 'new_company'
Title: "Setup Business"
Confirm: "Create Company"
Layout: grid grid-cols-1 md:grid-cols-12 gap-6
Left col (7/12): Business Name | Currency select | 4-digit PIN | Industry | Import Backup link
Right col (5/12): Info card
  Bullet list: PIN Protection, Local-First Storage, Backup & Restore
  Privacy disclaimer text (italic, blue-tinted)
Currencies: PKR(₨) | USD($) | EUR(€) | GBP(£) | AED(د.إ)
PIN input: type="password" maxLength=4 tracking-[1em] text-center
On Confirm: handleCreateCompany() → navigate to dashboard
```

### `edit_company` — Edit Business
```
Key: 'edit_company'
Title: "Edit Business"
Confirm: "Save Changes"
Layout: same 7+5 grid as new_company
Left col: Business Name | Currency | PIN | Industry
Right col: Security Settings info card
  Access PIN explanation, Modifying Details note
Used from: EllipsisMenu on company card, "Secure Now" banner
```

### `new_account` — Add Account
```
Key: 'new_account'
Title: "New Account"
Confirm: "Add Account"
Layout: space-y-4
Fields: Account Name | Account Type (select) | Account Code (auto-gen) | Opening Balance | Description (textarea)
Account Type select: Asset(1xxx) | Liability(2xxx) | Equity(3xxx) | Revenue(4xxx) | Expense(5xxx)
Code: auto-generated from type prefix + next available number
Returns to: previousModal if coming from an entry modal (passes new account ID back)
```

### `edit_account` — Edit Account
```
Key: 'edit_account'
Title: "Edit Account"
Confirm: "Save Changes"
Same fields as new_account, pre-filled
```

### `entry_type_choice` — Choose Entry Type
```
Key: 'entry_type_choice'
Title: "Choose Entry Type"
Layout: 2-column grid (1 on mobile, 2 on sm+)
Option 1 — Standard Ledger Entry:
  Icon: ArrowUpDown in blue-500/10 bg, 64px
  Label: "Standard Ledger Entry"
  Sub: "Double Entry (One Dr, One Cr)"
  Opens: new_entry_single
Option 2 — Multiline / Split Entry:
  Icon: LayoutDashboard in purple-500/10 bg
  Label: "Multiline / Split Entry"
  Sub: "Advanced Peachtree Style (Multiple Dr/Cr)"
  Opens: new_entry
Both cards: hover scale icon, hover:border-blue-500/30 (or purple)
```

### `new_entry_single` / `edit_entry_single` — Standard Ledger Entry (`SingleEntryModal`)
```
Keys: 'new_entry_single', 'edit_entry_single'
Title: "Add" / "Edit Entry"
Confirm: "Post Entry" / "Update Entry"
Fields:
  Transaction Date: date input
  Debit Account: SearchableSelect (colorClass: text-teal-400), excludes credit account from options
  Credit Account: SearchableSelect (colorClass: text-orange-400), excludes debit account from options
  Reverse Dr/Cr: ArrowUpDown swap button (text-blue-400)
  Amount: number input, text-xl font-black
  Notes: text input (description)
  Reference #: text input
Body: h-full flex flex-col p-4 md:p-6, overflow-y-auto native-scroll
```

### `new_entry` / `edit_entry` — Multiline Journal Entry (`JournalEntryModal`)
```
Keys: 'new_entry', 'edit_entry'
Title: "Add Entry" / "Edit Entry"
Confirm: "Post Entry" / "Update Entry" (disabled if unbalanced, shows "Unbalanced")
Layout: grid grid-cols-1 md:grid-cols-12 (split panel)
Left col (7/12): Date | Ref | Action bar | Lines table | Footer totals
Right col (5/12): Line editor (absolute overlay on mobile) or Help/status panel

Action bar: "N Lines" count | Reverse DR/CR Lines (swap all) | + Add Line
Lines table (scrollable):
  Cols: Account | Debit (teal) | Credit (orange) | Delete (Trash2 red)
  Click row: opens line editor panel
  Empty: italic placeholder text

Footer totals:
  Dr total (teal) | Balanced pill (green/red) | Cr total (orange)
  Pill: "Balanced" or "-AMOUNT" difference

Right panel — Line Editor:
  DEBIT/CREDIT tabs: teal bg (active debit), orange bg (active credit)
  SearchableSelect for account
  Amount input (text-base font-black)
  Detail text input
  Reference text input
  Cancel | Apply Line buttons
  → Can open new_account inline (saves editingLine as draft)

Right panel — Status/help (no line editing):
  Status: "Balanced" (teal) or "Out of Balance" (red) with difference
  Pill badge + icon
```

### `delete_confirm` — Delete Transaction
```
Key: 'delete_confirm'
Title: "Delete Transaction"
Confirm: "Permanently Delete"
Centered layout, max-w-md
  Bouncing Trash2 icon (red bg)
  "Are you absolutely sure?" text
  "This will wipe the transaction from ALL involved accounts."
  PIN field (if company has PIN): tracking-[1em] text-center, focus:border-red-500/50
On confirm: handleDeleteTransaction(transactionToDelete!)
```

### `delete_confirm_account` — Delete Account
```
Key: 'delete_confirm_account'
Title: "Delete Account"
Confirm: "Permanently Delete"
Centered, Trash2 icon
"Delete this account?" + sub-text
PIN field if PIN set
On confirm: confirmDeleteAccount()
```

### `delete_company_confirm` — Delete Business
```
Key: 'delete_company_confirm'
Title: "Delete Business"
Confirm: "Permanently Delete"
Shows company name in red font
"This action is final and will erase all associated financial journals & ledger accounts."
PIN field if company has PIN
On confirm: removes company from data, navigates to companies if was active
```

### `factory_reset_confirm` — Delete All Databases
```
Key: 'factory_reset_confirm'
Title: "Delete All Databases"
Confirm: "Permanently Reset"
Bouncing AlertCircle icon
"This action is absolutely irreversible."
PIN field if active company has PIN
On confirm: localStorage.clear() + indexedDB.deleteDatabase(DB_NAME) + window.location.reload()
```

### `settings` — Settings Modal
```
Key: 'settings'
Title: "Settings"
Confirm: "Done"
Layout: grid grid-cols-1 md:grid-cols-12, two scrollable columns

Left col (7/12): Preferences & Controls
  Dark Mode toggle: w-10 h-5 rounded-full (bg-blue-600 dark / bg-gray-400 light)
    Thumb: absolute w-3 h-3 rounded-full bg-white transitions left
  Data Sync section:
    3-column button grid: Save (Download/blue) | Share (Share2/teal) | Import (Upload/purple)
    Save: saveFileLocally JSON backup to Documents/LedgerPro
    Share: shareFile JSON via Android share intent
    Import: file input .json → importData()
  Active Company section:
    select dropdown → change active company
    "Manage All" → view = 'companies'
  Factory Reset: "Delete All Databases" — red/danger button

Right col (5/12): Database Diagnostics
  Header: Activity icon (purple) + "Database Diagnostics"
  Stats cards: Businesses | Ledgers | Postings | Size (KB)
  Health banner: purple-tinted "IndexedDB Health Indicator"
```

---

## 14. Native Android Integration

### Capacitor Config (`capacitor.config.ts`)
```typescript
appId: 'com.ledgerpro.app'
appName: 'LedgerPro'
webDir: 'dist'
androidScheme: 'https'

Plugins:
  SplashScreen:
    launchShowDuration: 1500
    launchAutoHide: true
    backgroundColor: '#111827'
    showSpinner: false
    splashFullScreen: true
    splashImmersive: true
  StatusBar:
    overlaysWebView: true
    style: 'DARK'
    backgroundColor: '#00000000'
  Keyboard:
    resize: 'native'
    resizeOnFullScreen: true

Android:
  allowMixedContent: false
  captureInput: false
  backgroundColor: '#111827'
  minWebViewVersion: 60
```

### Android Manifest Permissions
```xml
INTERNET
READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE
VIBRATE
RECEIVE_BOOT_COMPLETED
POST_NOTIFICATIONS
SCHEDULE_EXACT_ALARM (minSdkVersion 31)
USE_BIOMETRIC
ACCESS_NETWORK_STATE
```

### Android Activity Attributes
```
android:hardwareAccelerated="true"
android:requestLegacyExternalStorage="true"
android:windowSoftInputMode="adjustResize"
android:launchMode="singleTask"
android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|
                        smallestScreenSize|screenLayout|uiMode|navigation|density"
```

### Android Styles
```xml
AppTheme: DayNight.NoActionBar
  colorPrimary: #3B82F6
  colorPrimaryDark: #111827
  windowLayoutInDisplayCutoutMode: shortEdges

AppTheme.NoActionBar:
  statusBarColor: #00000000 (transparent)
  navigationBarColor: #00000000 (transparent)
  windowDrawsSystemBarBackgrounds: true
  windowLayoutInDisplayCutoutMode: shortEdges

AppTheme.NoActionBarLaunch: Theme.SplashScreen
  windowSplashScreenBackground: #111827
  windowSplashScreenAnimatedIcon: @mipmap/ic_launcher
  postSplashScreenTheme: @style/AppTheme.NoActionBar
```

### Native Haptic Helpers
```typescript
hapticImpact(style: ImpactStyle)  // Light/Medium/Heavy
hapticSuccess()                    // NotificationType.Success
hapticError()                      // NotificationType.Error
hapticWarning()                    // NotificationType.Warning
```

**Where haptics fire:**
- PIN keypad: `ImpactStyle.Light` on every key press
- Correct PIN: `hapticSuccess()`
- Wrong PIN: `hapticError()`
- Any `notify()` success: `hapticSuccess()`
- Any `notify()` error: `hapticError()`
- Back button: `ImpactStyle.Light`

### Native Lifecycle Effects
```
On mount (isNativePlatform):
  StatusBar.setOverlaysWebView({ overlay: true })
  StatusBar.setStyle({ style: Dark })
  StatusBar.setBackgroundColor({ color: '#00000000' })
  SplashScreen.hide({ fadeOutDuration: 300 })
  Keyboard.setAccessoryBarVisible({ isVisible: false })
  Keyboard.setScroll({ isDisabled: false })
  CapApp.addListener('appStateChange') → auto-backup JSON on background

On theme change:
  StatusBar.setStyle({ style: Dark|Light })

On back button press:
  → close modal OR navigate back OR exit app

Auto-backup (on appStateChange isActive=false):
  Filesystem.writeFile to Documents/LedgerPro/auto_backup.json
```

### File System Operations
```typescript
// Save to Documents (persists across app updates)
saveFileLocally(filename, content, mimeType, isBase64?)
  → path: LedgerPro/{filename} in Directory.Documents
  → notifies: "Downloaded to Documents/LedgerPro: {filename}"

// Share via Android share sheet
shareFile(filename, content, isBase64?)
  → writes to Directory.Cache first (temp)
  → Share.share({ title, url: result.uri })

// Ensure folder exists
ensureLedgerProDir()
  → Filesystem.mkdir('LedgerPro', Directory.Documents, recursive: true)
```

---

## 15. PDF Export System

### `exportToPDF(title, headers, rows, summary?, mode?)`
```typescript
mode: 'download' | 'share'  // default: 'download'

PDF Header:
  Company name — fontSize 22, textColor 40
  Report title — fontSize 14, textColor 80
  Period text — fontSize 9, textColor 120
  Total Pages — dynamic
  Run Date

Right-side summary block: label + value pairs aligned at right edge

Table (autoTable):
  headStyles: fillColor [59,130,246] (blue), white text, bold
  alternateRowStyles: fillColor [230,235,245]
  (+) marker → textColor [16,185,129] (green)
  (-) marker → textColor [239,68,68] (red)
  Footer: page number centered

On native: doc.output('datauristring') → save or share
On web: doc.save(filename)

Filename sanitization: /[^a-z0-9]/gi → '_'
```

### Reports Available for Export
| Report | Headers | Source |
|---|---|---|
| Profit & Loss | Description, '', Amount | `plData` computed from revenue/expense accounts |
| Balance Sheet | Account, '', Balance | All account types |
| Trial Balance | Account, Debit, Credit | `tbData` with normal side calculation |
| Chart of Accounts | Code, Name, Type, Balance | `filtered` accounts |
| Ledger (account) | Date Description, Contra Account, Debit(+), Credit(-), Balance | `filteredEntries` with running balance |
| Transaction Register | Date, Account, Description, Contra, Ref, Debit, Credit | All entries in date range |

---

## 16. Data Persistence

### IndexedDB
```
Database name: "LedgerProDB"
Store name: "AppData"
Version: 1
Key: "app_state"
Value: Full AppData object (JSON serialized)
Auto-save: useEffect on data change, when isLoaded = true
```

### localStorage
```
'theme': 'dark' | 'light'
'ledgerpro_active_company_id': number string
```

### Import / Export
```
Export: JSON.stringify(data, null, 2) → .json file
Format: { companies: [...], nextId: N, lastUsedDate?: string }
Import validation: checks imported.companies && imported.nextId
On import: replaces entire data state, navigates to companies, clears selectedCompanyId
```

---

## 17. Toast Notification System

```
State: toast: { msg: string; type: 'success'|'error' } | null
Auto-dismiss: 3000ms (setTimeout)
Haptics: success → hapticSuccess(), error → hapticError()
Position: fixed bottom-24 (above bottom nav), left-4 right-4, z-[200]
Max width: max-w-sm mx-auto
Style (success): bg-teal-500 text-white
Style (error): bg-red-500 text-white
Content: CheckCircle2 | AlertCircle icon + message text
Animation: y: 50→0, opacity 0→1 (enter); y: 50, opacity 0 (exit)
```

---

## 18. Business Logic & Accounting Engine

### Account Balance Calculation
```typescript
getAccountBalance(acc, asOfDate?, startDate?)
  - Income Statement accounts (revenue, expense): opening = 0 (period-based)
  - Balance Sheet accounts: opening = acc.openingBalance
  - For each entry: if date <= asOfDate AND date >= startDate
    - Normal side match → +amount (increases balance)
    - Opposite side → -amount (decreases balance)
```

### Running Balance (for Ledger)
```typescript
getSortedEntriesWithRunningBalance(acc, start?, end?)
  - Sort entries by date ASC, then by id ASC
  - Track running balance from openingBalance
  - Apply normal/contra sign per account type
  - Filter to date range
  - Return in reverse (newest first)
```

### Transaction Reversal
```typescript
handleCreateReversal(txId)
  - Flips entry.type: 'debit' ↔ 'credit' for all entries with that txId
  - Prepends 'REV-' to reference, or removes it if already prefixed
  - Instant save (no modal, direct state mutation)
```

### Edit Transaction (reconstruct modal state)
```typescript
handleEditTransaction(txId)
  - Scans all accounts for entries with matching transactionId
  - Rebuilds txnItems array (account, debit/credit, amount, detail, ref)
  - If exactly 2 entries → isSingleEntryFormat = true
  - Opens 'edit_entry' modal (always multiline format for edit)
```

### Date Range Utility
```typescript
getDatesForRange(range, custom?) → { start: string, end: string }
  - Uses local midnight dates (avoids timezone bugs)
  - 'all' → { start: '1970-01-01', end: today }
  - 'this_month' → first of month → today
  - etc.
```

### Account Code Auto-Generation
```typescript
generateNextAccountCode(type, company)
  - prefix: {asset:1, liability:2, equity:3, revenue:4, expense:5}
  - Find all existing accounts of same type with numeric codes
  - Return max(existing) + 1, or prefix+'001' if none
```

---

## 19. UI Interaction Patterns

### Touch Active States
```
Buttons: active:scale-95 (most CTAs)
List cards: active:scale-[0.98]
PIN keys: active:scale-90
Nav FAB: active:scale-90
```

### Z-Index Layers
```
5    — default content
20   — sticky account search bar
30   — hovered list items (for EllipsisMenu popup)
50   — bottom navigation
60   — header
80   — DateFilter dropdown backdrop
90   — DateFilter dropdown
100  — Modal backdrop
100  — EllipsisMenu backdrop
110  — EllipsisMenu dropdown
110  — SearchableSelect backdrop
120  — SearchableSelect dropdown
200  — LockScreen
200  — Toast notification
```

### Balance Pill Pattern
```
Balanced:   bg-teal-500/10 text-teal-400 border-teal-500/20 → "Balanced"
Unbalanced: bg-red-500/10  text-red-500  border-red-500/20  → "-AMOUNT"
```

### Entry Amount Color Coding
```
Positive effect (entry.type === typeInfo.normal): text-teal-400, prefix '+'
Negative effect (entry.type ≠ typeInfo.normal):  text-orange-400, prefix '-'
```

### Input Field Standard Pattern
```html
<label class="text-[10px] font-black text-[var(--muted)] uppercase">LABEL</label>
<input class="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl
              px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]">
```

### Select Standard Pattern
```html
<select class="w-full bg-[var(--surface)] border border-[var(--border)]
               rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-[var(--text-bright)]">
```

### Delete Button Danger Pattern
```
text-red-400/60 → hover:text-red-400 → hover:bg-red-500/10 (all at once)
```

### Section Label Pattern (above lists)
```
text-[9px] md:text-[10px] uppercase tracking-widest text-[var(--muted)] font-black
```

---

## 20. File Structure

```
f:/ledgerpro/
│
├── src/
│   ├── main.tsx                     # React root, renders <App>
│   ├── App.tsx                      # Entire application (4,004 lines)
│   │   ├── Lines 1–80:   Imports (React, Lucide, Motion, Recharts, Capacitor)
│   │   ├── Lines 81–105: Native helper functions (hapticImpact, hapticSuccess, etc.)
│   │   ├── Lines 106–175: TypeScript interfaces & date range config
│   │   ├── Lines 176–244: Utility functions & constants (formatDate, ACCOUNT_TYPES, DB consts)
│   │   ├── Lines 247–291: Modal component
│   │   ├── Lines 294–329: EllipsisMenu component
│   │   ├── Lines 331–405: SearchableSelect component
│   │   ├── Lines 407–469: DateFilter component
│   │   ├── Lines 471–544: LockScreen component
│   │   ├── Lines 547–893: FinancialReports component
│   │   ├── Lines 895–1281: JournalEntryModal component
│   │   ├── Lines 1284–1374: SingleEntryModal component
│   │   ├── Lines 1376–1415: IndexedDB helpers (initDB, loadAppData, saveAppData)
│   │   ├── Lines 1418–1599: App() state + useEffects (init, native setup, back button)
│   │   ├── Lines 1600–1988: Core handlers (CRUD companies, accounts, entries)
│   │   ├── Lines 1989–2155: File operations (save, share, exportToPDF)
│   │   ├── Lines 2157–2574: renderCompanies(), renderDashboard()
│   │   ├── Lines 2576–2952: renderAccounts(), renderJournal()
│   │   ├── Lines 2954–3643: renderModals() — all modal definitions
│   │   ├── Lines 3645–3801: renderBalanceSheet()
│   │   └── Lines 3803–4004: exportData, importData, App JSX shell (header, nav, modals, toast)
│   └── index.css                    # Design tokens + Tailwind theme + utility classes
│
├── android/
│   └── app/src/main/
│       ├── AndroidManifest.xml      # Permissions, activity config, FileProvider
│       ├── assets/public/           # Compiled web assets (from dist/ via cap sync)
│       └── res/values/
│           ├── styles.xml           # AppTheme, NoActionBar, Splash theme
│           └── strings.xml          # App name strings
│
├── public/
│   ├── icons/                       # PWA icons (multiple sizes)
│   └── manifest.webmanifest         # PWA manifest
│
├── capacitor.config.ts             # Capacitor plugin config
├── vite.config.ts                  # Vite build config + PWA plugin
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript config
└── ledgerpro_detailed_specification.md  # This document
```

---

## Appendix: Key Patterns for Future Apps

### Pattern: Local-First Data Storage
Use IndexedDB for primary data, localStorage for lightweight preferences. Always check `isLoaded` before auto-saving to prevent overwriting with empty state.

### Pattern: Full-Height Modals (Mobile Sheet)
Instead of centered dialog boxes, use `fixed inset-0 h-full` with safe-area-aware header and footer padding. This feels native on Android.

### Pattern: EllipsisMenu Z-Index Elevation
Set list items to `z-0` normally, use `hover:z-30 focus-within:z-30` to elevate the card on hover so the absolute-positioned dropdown overflows correctly above sibling cards.

### Pattern: Shared formData State
Use a single `formData: any` state object shared across all modals. This enables the `previousModal` flow where a new-account modal can return to a journal entry modal with the new account pre-selected.

### Pattern: Capacitor Feature Detection
Always wrap native API calls: `if (Capacitor.isNativePlatform()) { ... }.catch(() => {})` to gracefully degrade on web.

### Pattern: Date String Format
Use `YYYY-MM-DD` strings exclusively (never Date objects in storage) for lexicographic comparison: `e.date >= activeRange.start && e.date <= activeRange.end`.

### Pattern: Global ID Counter
Use a single `nextId` integer in root state. Increment it for every new entity (company, account, entry, transaction). This avoids per-collection ID tracking and ensures globally unique IDs.

### Pattern: Reversal Tracking
Prefix reversed entries with `REV-` in the reference field. Toggle: if already `REV-xxx`, remove prefix; otherwise add it. This makes reversals visually identifiable without a separate database flag.
