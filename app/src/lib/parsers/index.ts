import { readSheetAsync } from "./sheetReader";
import { toDate, toNumber, toNumberOrZero, toRequiredString, toOptionalString } from "./cellHelpers";
import type {
  GlEntry,
  BudgetEntry,
  TrialBalanceEntry,
  ChartOfAccount,
  CurrencyRate,
  Territory,
  CashFlowMapping,
  SoceMapping,
  CalendarDay,
  ValidationIssue,
} from "../types";

export interface ParseResult<T> {
  rows: T[];
  totalRowsSeen: number;
  issues: ValidationIssue[];
}

export async function parseGl(buffer: Buffer): Promise<ParseResult<GlEntry>> {
  const raw = await readSheetAsync(buffer, "GL");
  const issues: ValidationIssue[] = [];
  const rows: GlEntry[] = [];
  for (const { rowNumber, values } of raw) {
    const entryNo = toRequiredString(values.EntryNo, rowNumber, "EntryNo", issues);
    const date = toDate(values.Date, rowNumber, "Date", issues);
    const territoryKey = toNumber(values.Territory_key, rowNumber, "Territory_key", issues);
    const accountKey = toNumber(values.Account_key, rowNumber, "Account_key", issues);
    const amount = toNumber(values.Amount, rowNumber, "Amount", issues);
    if (entryNo === null || date === null || territoryKey === null || accountKey === null || amount === null) continue;
    rows.push({ entryNo, date, territoryKey, accountKey, details: toOptionalString(values.Details), amount });
  }
  return { rows, totalRowsSeen: raw.length, issues };
}

export async function parseBudget(buffer: Buffer): Promise<ParseResult<BudgetEntry>> {
  const raw = await readSheetAsync(buffer, "Budget");
  const issues: ValidationIssue[] = [];
  const rows: BudgetEntry[] = [];
  for (const { rowNumber, values } of raw) {
    const entryNo = toRequiredString(values.EntryNo, rowNumber, "EntryNo", issues);
    const date = toDate(values.Date, rowNumber, "Date", issues);
    const territoryKey = toNumber(values.Territory_key, rowNumber, "Territory_key", issues);
    const accountKey = toNumber(values.Account_key, rowNumber, "Account_key", issues);
    const amount = toNumber(values.Amount, rowNumber, "Amount", issues);
    if (entryNo === null || date === null || territoryKey === null || accountKey === null || amount === null) continue;
    rows.push({
      entryNo,
      date,
      territoryKey,
      accountKey,
      details: toOptionalString(values.Details),
      amount,
      type: toOptionalString(values.Type),
    });
  }
  return { rows, totalRowsSeen: raw.length, issues };
}

export async function parseTrialBalance(buffer: Buffer): Promise<ParseResult<TrialBalanceEntry>> {
  const raw = await readSheetAsync(buffer, "TB");
  const issues: ValidationIssue[] = [];
  const rows: TrialBalanceEntry[] = [];
  for (const { rowNumber, values } of raw) {
    const date = toDate(values.Date, rowNumber, "Date", issues);
    const territoryKey = toNumber(values.Territory_key, rowNumber, "Territory_key", issues);
    const accountKey = toNumber(values.Account_key, rowNumber, "Account_key", issues);
    // Blank Amount = no balance recorded for this account/territory/month, not an error.
    const amount = toNumberOrZero(values.Amount, rowNumber, "Amount", issues);
    if (date === null || territoryKey === null || accountKey === null || amount === null) continue;
    rows.push({ date, territoryKey, accountKey, amount });
  }
  return { rows, totalRowsSeen: raw.length, issues };
}

export async function parseChartOfAccounts(buffer: Buffer): Promise<ParseResult<ChartOfAccount>> {
  const raw = await readSheetAsync(buffer, "Chart of Accounts");
  const issues: ValidationIssue[] = [];
  const rows: ChartOfAccount[] = [];
  for (const { rowNumber, values } of raw) {
    const accountKey = toNumber(values.Account_key, rowNumber, "Account_key", issues);
    const report = toRequiredString(values.Report, rowNumber, "Report", issues);
    const classSorting = toNumber(values.Class_sorting, rowNumber, "Class_sorting", issues);
    const subClassSorting = toNumber(values.SubClass_sorting, rowNumber, "SubClass_sorting", issues);
    const subClass2Sorting = toNumber(values.SubClass2_sorting, rowNumber, "SubClass2_sorting", issues);
    const accountSorting = toNumber(values.Account_sorting, rowNumber, "Account_sorting", issues);
    if (
      accountKey === null ||
      report === null ||
      classSorting === null ||
      subClassSorting === null ||
      subClass2Sorting === null ||
      accountSorting === null
    )
      continue;
    rows.push({
      accountKey,
      report,
      class: toOptionalString(values.Class),
      classSorting,
      subClass: toOptionalString(values.SubClass),
      subClassSorting,
      subClass2: toOptionalString(values.SubClass2),
      subClass2Sorting,
      account: toOptionalString(values.Account),
      accountSorting,
      subAccount: toOptionalString(values.SubAccount),
    });
  }
  return { rows, totalRowsSeen: raw.length, issues };
}

export async function parseCurrency(buffer: Buffer): Promise<ParseResult<CurrencyRate>> {
  const raw = await readSheetAsync(buffer, "EUR_USD Historical Data");
  const issues: ValidationIssue[] = [];
  const rows: CurrencyRate[] = [];
  for (const { rowNumber, values } of raw) {
    const date = toDate(values.Date, rowNumber, "Date", issues);
    const currency = toRequiredString(values.Currency, rowNumber, "Currency", issues);
    const exchangeRate = toNumber(values.Exchange_Rate, rowNumber, "Exchange_Rate", issues);
    // Note the source header has a stray space: "Territory _key".
    const territoryKey = toNumber(values["Territory _key"], rowNumber, "Territory _key", issues);
    if (date === null || currency === null || exchangeRate === null || territoryKey === null) continue;
    rows.push({ date, currency, exchangeRate, territoryKey });
  }
  return { rows, totalRowsSeen: raw.length, issues };
}

export async function parseTerritory(buffer: Buffer): Promise<ParseResult<Territory>> {
  const raw = await readSheetAsync(buffer, "Territory");
  const issues: ValidationIssue[] = [];
  const rows: Territory[] = [];
  for (const { rowNumber, values } of raw) {
    const territoryKey = toNumber(values.Territory_key, rowNumber, "Territory_key", issues);
    const country = toRequiredString(values.Country, rowNumber, "Country", issues);
    if (territoryKey === null || country === null) continue;
    rows.push({ territoryKey, country, region: toOptionalString(values.Region) });
  }
  return { rows, totalRowsSeen: raw.length, issues };
}

export async function parseCashFlowMapping(buffer: Buffer): Promise<ParseResult<CashFlowMapping>> {
  const raw = await readSheetAsync(buffer, "CashFlow_St");
  const issues: ValidationIssue[] = [];
  const rows: CashFlowMapping[] = [];
  for (const { rowNumber, values } of raw) {
    const accountKey = toNumber(values.Account_Key, rowNumber, "Account_Key", issues);
    const valueType = toRequiredString(values.ValueType, rowNumber, "ValueType", issues);
    const sortOnType = toNumber(values["Sort on Type"], rowNumber, "Sort on Type", issues);
    const sortOnSubType = toNumber(values["Sort on SubType"], rowNumber, "Sort on SubType", issues);
    if (accountKey === null || valueType === null || sortOnType === null || sortOnSubType === null) continue;
    rows.push({
      type: toOptionalString(values.Type),
      subtype: toOptionalString(values.Subtype),
      account: toOptionalString(values.Account),
      subAccount: toOptionalString(values.SubAccount),
      valueType,
      accountKey,
      sortOnType,
      sortOnSubType,
    });
  }
  return { rows, totalRowsSeen: raw.length, issues };
}

export async function parseSoce(buffer: Buffer): Promise<ParseResult<SoceMapping>> {
  const raw = await readSheetAsync(buffer, "SoCE_St");
  const issues: ValidationIssue[] = [];
  const rows: SoceMapping[] = [];
  for (const { rowNumber, values } of raw) {
    const accountKey = toNumber(values.AccountKey, rowNumber, "AccountKey", issues);
    const balanceType = toRequiredString(values.Balancetype, rowNumber, "Balancetype", issues);
    const sortByType = toNumber(values["Sort by type"], rowNumber, "Sort by type", issues);
    const sortByAccount = toNumber(values["Sort by Account"], rowNumber, "Sort by Account", issues);
    if (accountKey === null || balanceType === null || sortByType === null || sortByAccount === null) continue;
    rows.push({
      type: toOptionalString(values.Type),
      account: toOptionalString(values.Account),
      balanceType,
      accountKey,
      sortByType,
      sortByAccount,
    });
  }
  return { rows, totalRowsSeen: raw.length, issues };
}

export async function parseCalendar(buffer: Buffer): Promise<ParseResult<CalendarDay>> {
  const raw = await readSheetAsync(buffer, "Calendar");
  const issues: ValidationIssue[] = [];
  const rows: CalendarDay[] = [];
  for (const { rowNumber, values } of raw) {
    const date = toDate(values.Date, rowNumber, "Date", issues);
    const year = toNumber(values.Year, rowNumber, "Year", issues);
    if (date === null || year === null) continue;
    rows.push({
      date,
      year,
      quarter: toOptionalString(values.Quarter),
      month: toOptionalString(values.Month),
      day: toOptionalString(values.Day),
    });
  }
  return { rows, totalRowsSeen: raw.length, issues };
}
