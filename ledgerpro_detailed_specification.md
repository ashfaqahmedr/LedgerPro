# LedgerPro Enterprise (v2.0): Complete UI & Logic Specification

This document serves as an exhaustive, production-grade technical specification and developer prompt for **LedgerPro Enterprise (v2.0)**. It details every view, state machine, calculator, modal flow, database structure, and deployment configuration for both the Web and Android wrappers.

---

## 1. Architecture, Environment & Build Settings

LedgerPro is structured as a client-side Progressive Web Application (PWA) with a Capacitor native container.

### 1.1 Tech Stack
*   **Core**: React 19 + TypeScript + Vite.
*   **Styling**: Tailwind CSS v4.0 (CSS variables design system).
*   **Animations**: Motion (formerly Framer Motion) for overlays, toast notices, page views, and keypad animations.
*   **Icons**: `lucide-react`.
*   **Database**: Browser IndexedDB (`LedgerProDB` via Native API).
*   **Reports**: `jspdf` + `jspdf-autotable` client-side compiler.
*   **Mobile Wrapper**: Capacitor CLI (`@capacitor/core`, `@capacitor/android`).

### 1.2 Build Configurations & Deployment Scripts
LedgerPro differentiates compile targets by setting base paths programmatically to support local Android file schemes alongside standard URL subfolders.

#### 1.2.1 Vite Configuration ([vite.config.ts](file:///f:/ledgerpro/vite.config.ts))
*   **Base Path**: Dynamic fallback via `process.env.VITE_BASE_PATH || '/'`.
*   **PWA Manifest Settings**:
    *   Name: `"LedgerPro Enterprise"`
    *   Short Name: `"LedgerPro"`
    *   Theme Color: `#3b82f6`
    *   Icons: WebP format sized 48x48, 72x72, 96x96, 128x128, 192x192, 256x256, 512x512 (with maskable option for 512x512).
*   **Build Directories**: Output to `/dist`, assets to `/assets`.
*   **Server Config**: HMR toggled dynamically using `DISABLE_HMR` to optimize file systems in local edit environments.

#### 1.2.2 Android Capacitor Settings ([capacitor.config.ts](file:///f:/ledgerpro/capacitor.config.ts))
*   App ID: `com.ledgerpro.app`
*   App Name: `LedgerPro`
*   Web Directory: `dist`
*   Server Scheme: `https`
*   **Native Splash & Launcher Config**:
    *   Launcher Icon uses `@mipmap/ic_launcher` gradient logo.
    *   Android Splash Screen uses the native Android `Theme.SplashScreen` system, avoiding static drawables or blank frames. Centers the launcher icon on a solid slate background (`#111827`).

#### 1.2.3 Build & Upload Automation ([deploy.js](file:///f:/ledgerpro/deploy.js))
*   Trigger: `npm run deploy`
*   Processes:
    1.  Loads environment variables from local `.env`.
    2.  Builds the app programmatically via `npx vite build` with `VITE_BASE_PATH="/accpro/"` forced.
    3.  Instantiates FtpDeploy with configuration:
        *   Remote Root: `/public_html/accpro` (customizable in `.env`).
        *   Parameters: `deleteRemote: true` (automatically purges all stale/unused files on target directory before upload), Passive Mode, secure FTP options (`rejectUnauthorized: false` for self-signed certificates).
        *   Outputs progress bar tracking upload percentages in real-time.

#### 1.2.4 Repository Synchronization ([git-push.js](file:///f:/ledgerpro/git-push.js))
*   Helper CLI script staging and pushing code with commands:
    1.  `git add .`
    2.  `git commit -m "[arg message || "chore: update codebase"]"`
    3.  `git push origin main`

---

## 2. Core Data Models (TypeScript Interfaces)

```typescript
type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

interface Entry {
  id: number;
  transactionId: number;
  date: string;              // Format: YYYY-MM-DD
  description: string;       // Line-item notes
  type: 'debit' | 'credit';
  amount: number;            // Always positive float
  reference: string;         // E.g., invoice number or voucher code
  contraAccountId: number;   // Opposing account ID (set to -1 for split transactions)
}

interface Account {
  id: number;
  name: string;
  code: string;              // Code mapping (e.g. 1001 for cash)
  type: AccountType;
  description: string;
  openingBalance: number;    // Balance at start of company creation
  entries: Entry[];
  createdAt: string;         // ISO String
}

interface Company {
  id: number;
  name: string;
  industry: string;
  currency: string;          // ISO currency code (PKR, USD, EUR, GBP, AED)
  pin?: string;              // Optional 4-digit numeric security PIN
  accounts: Account[];
  createdAt: string;
}

interface AppData {
  companies: Company[];
  nextId: number;            // Auto-increment ID generator sequence
  lastUsedDate?: string;     // Date placeholder sticky default
}

type ViewType = 'companies' | 'dashboard' | 'accounts' | 'journal' | 'reports';

type DateRangeType = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom';

interface DateRange {
  start: string;
  end: string;
}
```

---

## 3. Design System & Theme Custom Custom Properties

LedgerPro implements a dark-first user interface with smooth transitions, color-coded entries, and high-contrast typography.

### 3.1 CSS Custom Property Mapping (Tailwind v4.0 Theme)
| Token | Light Value (HSL) | Dark Value (HSL) | CSS Element |
| :--- | :--- | :--- | :--- |
| `--bg` | `210 20% 98%` | `222 47% 6%` | Workspace Background |
| `--surface` | `210 20% 95%` | `222 47% 10%` | Inputs, sub-navs, headers |
| `--card` | `0 0% 100%` | `222 47% 12%` | Layout grids, dropdowns, lists |
| `--border` | `210 16% 90%` | `222 47% 16%` | Separation borders |
| `--text` | `215 16% 47%` | `215 16% 65%` | Secondary and description tags |
| `--text-bright`| `222 47% 12%` | `210 20% 98%` | Main headers and labels |
| `--muted` | `215 16% 57%` | `215 16% 45%` | Placeholders, disabled states |
| `--primary` | `221 83% 53%` | `221 83% 53%` | Accent Highlight Blue (`#3b82f6`) |

### 3.2 Double-Entry Bookkeeping Visual Codes
To emphasize movements under normal balance directions, financial numbers are color-coded:
*   **Positive Normal Impact (+)**: Teal color (`#10b981` / `text-teal-400`).
*   **Negative Normal Impact (-)**: Orange/Red color (`#f97316` / `text-orange-400`).

---

## 4. Security & Authentication: PIN Keypad System

When selecting a business that contains a 4-digit security PIN in its metadata (`pin`), a full-screen lock layer blocks the interface.

```
       [Lock Icon]
      Selected Company
     Protected by PIN
     
      O   O   O   O  (Dot Indicators)
      
       1   2   3
       4   5   6
       7   8   9
           0   C
           
  [<- Switch Business / Exit]
```

### 4.1 UI Layout
*   **Logo/Header**: Centered lock icon (`Lock` size 40) in a translucent blue circle, company name (size 2xl, bold), and lock notice.
*   **Indicator Panel**: 4 circular dot markers (`w-4 h-4`) with thick borders. When a digit is entered, the dots fill with blue background sequentially.
*   **Numeric Grid Keypad**: 3x4 layout. Keys `1-9`, `0`, and a Clear (`C`) key. The bottom-left key is an empty space. Clicking a key scales down slightly (`active:scale-90`) and registers click audio/vibrates.
*   **Exit Command**: A bottom text button "Switch Business / Exit" resets the selected company and drops back to the company dashboard directories.

### 4.2 Keypad Authentication Logic
1.  User enters digits; they append to a draft input string.
2.  On reaching length 4, compares input with the company's PIN:
    *   **Success**: Sets `isUnlocked = true`, sets view state, and transitions view using Framer Motion.
    *   **Fail**: Colors the dots red, triggers an error shake animation, vibrates, pauses for 500ms, and resets the draft input string.

---

## 5. Main Views & Navigation Architecture

### 5.1 Global App Header
*   **Left Section**: LedgerPro icon, Title "LedgerPro", and Subtitle "Enterprise v2.0".
*   **Right Section**:
    *   *No Company Loaded*: Settings gear icon (opens settings panel).
    *   *Company Loaded*: Back arrow (resets active company, forces lock state on next open, and clears selection).

### 5.2 Bottom Navigation Bar (Mobile)
Rendered sticky to the bottom of the screen only when a company is successfully loaded and unlocked.
1.  **Live (Dashboard)**: Metric charts and entries.
2.  **Accounts**: Access Chart of Accounts, balances, and ledger logs.
3.  **Center Add Button (`+`)**: A raised, circular blue button (`w-12 h-12`) floating above the navigation bar with a heavy shadow. Triggers the choice popover modal.
4.  **Reports**: Business performance sheets (P&L, Balance Sheet, Trial Balance).
5.  **Settings**: App customization and backups.

### 5.3 View Flow Details
*   **Businesses Directory (`view === 'companies'`)**:
    *   Lists all registered companies with custom logo placeholders (purple gradient containing `Building2` icon), and three-dot edit/delete menu.
    *   Features an "Import Backup" file-upload prompt and "+ New Business" button.
    *   If database is empty, displays a retro illustration card prompting database configuration.
*   **Live Dashboard (`view === 'dashboard'`)**:
    *   Shows a "Secure Now" security banner if the company has no PIN set.
    *   Features a date range picker and search inputs.
    *   Outputs four summary statistics cards: Opening Balance, Debits, Credits, and Closing Balance.
    *   Displays recent entries with their corresponding contra account labels.
*   **Chart of Accounts (`view === 'accounts'`)**:
    *   Tabular collection showing Name, Code, Type, and Closing Balance.
    *   Enables quick search by code or title and alphabetical sorting.
    *   Each account card has a context menu for editing, deleting, or viewing journal ledger history.
*   **Journal Ledger Details (`view === 'journal'`)**:
    *   Shows running ledger statements for the selected account, highlighting Debits, Credits, and cumulative balances line-by-line.
    *   Contains Quick Add entries, Export to PDF, and chronological sorting.
*   **Reports Center (`view === 'reports'`)**:
    *   Three sub-tabs: Profit & Loss Statement, Balance Sheet Statement, and Trial Balance.
    *   P&L outputs Total Revenues, Total Expenses, Net Profit/Loss, and Profit Margins.
    *   Balance Sheet outputs asset accounts, liabilities, equity, and retained earnings (validating `Assets === Liabilities + Equity` with an alert banner).
    *   Trial Balance outputs accounts matching debit or credit normal values, concluding with bottom totals verification.

---

## 6. Comprehensive Modals & Forms Specifications

Every modal is structured inside an animated backdrop overlay (`backdrop-blur-sm bg-black/60`).

### 6.1 Setup Business Modal (`new_company`) & Edit Business Modal (`edit_company`)
*   **Input Fields**:
    *   *Name*: Text input, autofocused, required.
    *   *Currency*: Dropdown select matching PKR (₨), USD ($), EUR (€), GBP (£), AED (د.إ).
    *   *4-Digit PIN*: Password input, filtered numeric-only, centered 1em spacing, optional.
    *   *Industry*: Text input.
*   **Import Integration**: Prompts an import button in the creation phase to restore full databases immediately.

### 6.2 New/Edit Account Modal (`new_account` / `edit_account`)
*   **Fields**:
    *   *Account Type Select*: Grid tabs for Asset, Liability, Equity, Revenue, Expense. Clicking a tab updates type configuration.
    *   *Auto-Code Prefixer*: If the account code field is empty, selecting a type automatically generates the next available code prefix.
    *   *Prefix mapping*: Asset: `1`, Liability: `2`, Equity: `3`, Revenue: `4`, Expense: `5`.
        *   Generates next sequential number (e.g. Asset 1001 exists, auto-populates 1002. If none exist, falls back to `1001`, `2001`, etc.).
    *   *Account Name*: Text input.
    *   *Code*: Text input.
    *   *Opening Balance*: Number input.
    *   *Description*: Textarea.

### 6.3 Choose Entry Type Modal (`entry_type_choice`)
Provides a choices screen upon clicking bottom navigation `+`:
*   *Standard Ledger Entry*: Redirects to a standard double-entry transaction modal.
*   *Multiline / Split Entry*: Redirects to a split entry modal.

### 6.4 Standard Transaction Modal (`new_entry_single` / `edit_entry_single`)
Used for recording basic transactions mapping one Debit account and one Credit account.
*   **Inputs**:
    *   *Transaction Date*: Date selector (defaults to today or `lastUsedDate`).
    *   *Debit Account Selector*: Searchable select. Drops down all account names and codes, filtering out the currently selected Credit account.
    *   *Credit Account Selector*: Searchable select. Drops down all accounts, filtering out the selected Debit account.
    *   *Swap Accounts Button*: Reverses the transaction direction by swapping the debit and credit selections.
    *   *Amount*: Number input.
    *   *Notes (Description)*: Text input.
    *   *Reference #*: Text input.
*   **Shortcuts**:
    *   Inside account dropdowns, clicking "Add New Account" launches the `new_account` modal. It stores the calling view state (`previousModal`) and returns seamlessly with the newly created account auto-selected (using draft account sync hooks).

### 6.5 Advanced Multiline / Split Entry Modal (`new_entry` / `edit_entry`)
Allows entering multiple credit and debit lines in one voucher.

```
       +---------------------------------------------+
       | Date: YYYY-MM-DD           Ref: RefCode     |
       |                                             |
       | Lines: 2 Lines       [Reverse DR/CR] [+ Add]|
       | +-----------------------------------------+ |
       | | Account         Debit           Credit  | |
       | | Cash            1,000.00        -       | |
       | | Sales           -               1,000.00| |
       | +-----------------------------------------+ |
       |                                             |
       | DR: 1,000.00     [ Balanced ]   CR: 1,000.00|
       +---------------------------------------------+
```

*   **Header**: Date input, reference text input.
*   **Action Row**:
    *   Line count indicator.
    *   *Reverse DR/CR lines button*: Swaps debit and credit values for all lines in the grid.
    *   *Add Line button*: Opens a slide-over/overlay Line Editor panel.
*   **Voucher Lines Table**:
    *   Displays added lines. Clicking a row opens it in the Line Editor panel. Each row features a delete trash icon.
*   **Voucher Totals Footer**:
    *   Debit Total sum, Credit Total sum, and a dynamic balancing status badge:
        *   *Balanced*: Green background (`bg-teal-500/10 text-teal-400 border-teal-500/20`), enables the "Post Entry" button.
        *   *Out of Balance*: Red background (`bg-red-500/10 text-red-500 border-red-500/20`), outputs the difference, and locks the "Post Entry" button.
*   **Inner Line Editor Panel**:
    *   *DR/CR Switch tabs*: Debit (teal styling) or Credit (orange styling).
    *   *Account Searchable Select*: Dropdown list, excluding accounts already added to this transaction. Contains "Add New Account" shortcut.
    *   *Amount*: Number input.
    *   *Detail (Line Note)*: Text input.
    *   *Reference*: Text input.
    *   *Validation*: Prevents duplicates. Clicking "Apply Line" updates the draft grid.

### 6.6 Settings Modal (`settings`)
Provides system tools.
*   **Dark Mode Toggle**: A slider switch changing UI styles between Light/Dark via document attributes.
*   **Data Sync**:
    *   *Export Data*: Downloads the complete database as a structured JSON backup.
    *   *Import Data*: Uploads a JSON backup. Validates that the file contains `companies` and `nextId` keys before overwriting IndexedDB data.
*   **Manage Businesses**: Toggles view to the main companies directory.
*   **Delete All Databases**: Triggers the factory reset confirmation.

### 6.7 Security Authorization & Delete Modals
All deletions require PIN clearance if the opened business is security-protected.

```
       [Warning Bouncing Icon]
          Confirm Deletion
       Enter Company PIN to Authorize
            [ * * * * ]
```

1.  **Delete Business Confirm Modal (`delete_company_confirm`)**:
    *   Outputs a warning about losing database ledgers. If the company is PIN-secured, the user must input the correct PIN to authorize deletion.
2.  **Delete Account Modal (`delete_confirm_account`)**:
    *   Warns about removing the selected account. Requires PIN validation prior to executing account array filter sweeps.
3.  **Delete Transaction Modal (`delete_confirm`)**:
    *   Warns that deletion will remove the entry from both debit and credit account journals. Requires security PIN.
4.  **Factory Reset Modal (`factory_reset_confirm`)**:
    *   Full warning for clearing local storage and dropping the database. If a company is currently open, requires its PIN for authorization.

---

## 7. Business Logic, Bookkeeping Rules & Calculations

### 7.1 Double-Entry Normal Balances & Effects
Each AccountType has a normal balance state determining which transaction type increases it.

| Account Type | Normal Balance | Positive Effect | Negative Effect |
| :--- | :--- | :--- | :--- |
| **Asset** | Debit | Debit Entry (`type === 'debit'`) | Credit Entry (`type === 'credit'`) |
| **Expense** | Debit | Debit Entry (`type === 'debit'`) | Credit Entry (`type === 'credit'`) |
| **Liability** | Credit | Credit Entry (`type === 'credit'`) | Debit Entry (`type === 'debit'`) |
| **Equity** | Credit | Credit Entry (`type === 'credit'`) | Debit Entry (`type === 'debit'`) |
| **Revenue** | Credit | Credit Entry (`type === 'credit'`) | Debit Entry (`type === 'debit'`) |

### 7.2 Balance Aggregation Function (`getAccountBalance`)
Balances are computed dynamically using:

$$\text{Balance} = \text{Opening Balance} + \sum (\text{Entries Matching Normal Balance}) - \sum (\text{Entries Opposed to Normal Balance})$$

*   **Income Statement (Revenue & Expense)**:
    *   Opening balance is treated as `0` for range evaluations, measuring only transactions between `startDate` and `endDate`.
*   **Balance Sheet (Asset, Liability, Equity)**:
    *   Calculates cumulative totals from the start of time up to the end date parameter.

### 7.3 Date Range Filter Processor
Converts selection options into calendar start/end date pairs:
*   *Today*: Current date midnight to current date end.
*   *Yesterday*: Current date minus 1.
*   *This Week*: Starts on Sunday of the current week.
*   *This Month*: Starts on day 1 of the current month.
*   *Last Month*: Starts on day 1 of the previous month to the final day of the previous month.
*   *This Year*: January 1 to current date.
*   *Last Year*: January 1 to December 31 of the previous calendar year.
*   *Custom Range*: Utilizes inputs from the manual calendar selector.

---

## 8. PDF Export Engine & Formatting Rules

The PDF compiler uses `jsPDF` and `jspdf-autotable` to format export data.

*   **Document Headers**:
    *   Title: Bold, dark primary color, size 22.
    *   Subtitle: Document type (e.g. Trial Balance), size 14.
    *   Metadata block: Outputs run date, page count placeholder string (`{total_pages_count_string}`), and date range filter values.
*   **Vertical Stats Summary Card**:
    *   Outputs running parameters (e.g. Total Debits/Credits, Opening/Closing Balance) in a right-aligned list next to the headers.
*   **Table Styles**:
    *   Primary headers colored Blue (`[59, 130, 246]`) with white bold text.
    *   Alternate row backgrounds (`[230, 235, 245]`).
    *   Negative or positive ledger balances are color-coded in real-time (`(+)` entries color teal `[16, 185, 129]`, `(-)` entries color red `[239, 68, 68]`).
    *   Bottom row outputs double underline total sums.
*   **Dynamic Pagination Footer**:
    *   Loops through sections, placing "Page X of Y" via the page number drawer `doc.putTotalPages`.

---

## 9. Local Storage & Sync Database Layer

All application states are persisted inside the browser's IndexedDB.

### 9.1 Schema Setup
*   **Database**: `LedgerProDB`
*   **Store**: `AppData`
*   **Key**: `app_state`

### 9.2 Operations
*   *Load*: On startup, initializes IndexedDB. If `app_state` exists, resolves it to local state; otherwise, returns empty arrays.
*   *Save*: Automatically saves updated state variables back to the store.
*   *Import/Export File Formats*: Backup files use JSON format. Export serializes data objects, wrapping them inside a download Blob named `ledgerpro_backup_YYYY-MM-DD.json`. Import parses the file contents and checks for required keys (`companies`, `nextId`) before overwriting database records.
