// =======================================================================
// PhysioRecord — Iraqi Clinic Financial Ledger & Expense Management (Phase 7)
// Primary Currency: Iraqi Dinar (IQD / د.ع) | Packages, Partial Payments, Debt & Expenses
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { usePatients } from '../../context/PatientContext';
import {
  ClinicOperationsService,
  formatIQD,
  ROLE_PERMISSIONS,
} from '../../services/clinicOperationsService';
import { localDate } from '../../utils/date';
import type {
  FinancialInvoiceIQD,
  IraqiPaymentMethod,
  ClinicExpenseIQD,
  ExpenseCategoryIQD,
} from '../../types/clinicManagement';
import {
  Wallet,
  Plus,
  Receipt,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Package,
  Trash2,
} from 'lucide-react';

export const IraqiFinancialLedgerView: React.FC = () => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const { activePatients } = usePatients();

  const [activeTab, setActiveTab] = useState<'invoices' | 'debts' | 'expenses' | 'reports'>('invoices');
  const [invoices, setInvoices] = useState<FinancialInvoiceIQD[]>([]);
  const [expenses, setExpenses] = useState<ClinicExpenseIQD[]>([]);
  const [showNewInvoiceForm, setShowNewInvoiceForm] = useState(false);
  const [showNewExpenseForm, setShowNewExpenseForm] = useState(false);

  // Partial Payment Collection Modal State
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] =
    useState<FinancialInvoiceIQD | null>(null);
  const [paymentAmountIQD, setPaymentAmountIQD] = useState<number>(25000);
  const [paymentMethod, setPaymentMethod] = useState<IraqiPaymentMethod>('cash_iqd');
  const [paymentNote, setPaymentNote] = useState('');

  // New Invoice Form State
  const [invPatientId, setInvPatientId] = useState('');
  const [invCustomName, setInvCustomName] = useState('');
  const [invType, setInvType] = useState<FinancialInvoiceIQD['invoiceType']>('single_session');
  const [invTitle, setInvTitle] = useState('');
  const [invTotalIQD, setInvTotalIQD] = useState<number>(25000);
  const [invDiscountIQD, setInvDiscountIQD] = useState<number>(0);
  const [invPaidIQD, setInvPaidIQD] = useState<number>(25000);
  const [invMethod, setInvMethod] = useState<IraqiPaymentMethod>('cash_iqd');
  const [invPackageSessions, setInvPackageSessions] = useState<number>(10);
  const [invNotes, setInvNotes] = useState('');

  // New Expense Form State
  const [expCategory, setExpCategory] = useState<ExpenseCategoryIQD>('medical_consumables');
  const [expTitle, setExpTitle] = useState('');
  const [expAmountIQD, setExpAmountIQD] = useState<number>(50000);
  const [expNotes, setExpNotes] = useState('');

  const activeStaff = ClinicOperationsService.getActiveStaff();
  const perms = ROLE_PERMISSIONS[activeStaff.role];

  useEffect(() => {
    setInvoices(ClinicOperationsService.getInvoicesIQD());
    setExpenses(ClinicOperationsService.getExpensesIQD());
  }, []);

  const handleInvoicePresetChange = (type: FinancialInvoiceIQD['invoiceType']) => {
    setInvType(type);
    if (type === 'single_session') {
      setInvTotalIQD(25000);
      setInvDiscountIQD(0);
      setInvPaidIQD(25000);
      setInvTitle(isAr ? 'جلسة علاج طبيعي وتأهيل مفردة' : 'Single PT Rehabilitation Session');
    } else if (type === 'rehab_package') {
      setInvTotalIQD(250000);
      setInvDiscountIQD(25000);
      setInvPaidIQD(125000);
      setInvPackageSessions(10);
      setInvTitle(isAr ? 'كورس تأهيل علاجي متكامل (10 جلسات)' : '10-Session Comprehensive Rehab Package');
    } else {
      setInvTotalIQD(35000);
      setInvDiscountIQD(0);
      setInvPaidIQD(35000);
      setInvTitle(isAr ? 'فحص وتقييم سريري أولي شامل' : 'Comprehensive Initial Evaluation');
    }
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = activePatients.find((p) => p.id === invPatientId);
    const resolvedName = matched ? matched.data.fullName : invCustomName.trim();
    if (!resolvedName) return;

    ClinicOperationsService.createInvoiceIQD({
      patientId: matched?.id || `pt_${Date.now()}`,
      patientName: resolvedName,
      invoiceType: invType,
      titleAr: invTitle || 'جلسة علاج طبيعي',
      titleEn: invTitle || 'PT Session',
      totalAmountIQD: invTotalIQD,
      discountIQD: invDiscountIQD,
      initialPaidIQD: invPaidIQD,
      paymentMethod: invMethod,
      packageTotalSessions: invType === 'rehab_package' ? invPackageSessions : undefined,
      notes: invNotes,
    });

    setInvoices(ClinicOperationsService.getInvoicesIQD());
    setShowNewInvoiceForm(false);
    setInvCustomName('');
    setInvNotes('');
  };

  const handleCollectPartialPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;
    const updated = ClinicOperationsService.recordPaymentOnInvoiceIQD(
      selectedInvoiceForPayment.id,
      paymentAmountIQD,
      paymentMethod,
      paymentNote
    );
    setInvoices(updated);
    setSelectedInvoiceForPayment(null);
    setPaymentNote('');
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || expAmountIQD <= 0) return;
    const updated = ClinicOperationsService.addExpenseIQD({
      date: localDate(),
      category: expCategory,
      titleAr: expTitle.trim(),
      titleEn: expTitle.trim(),
      amountIQD: expAmountIQD,
      paidBy: activeStaff.nameAr,
      notes: expNotes,
    });
    setExpenses(updated);
    setShowNewExpenseForm(false);
    setExpTitle('');
    setExpNotes('');
  };

  const totalBilledIQD = invoices.reduce((s, i) => s + i.netAmountIQD, 0);
  const totalCollectedIQD = invoices.reduce((s, i) => s + i.paidAmountIQD, 0);
  const totalDebtIQD = invoices.reduce((s, i) => s + i.balanceDueIQD, 0);
  const totalExpensesIQD = expenses.reduce((s, e) => s + e.amountIQD, 0);
  const netProfitIQD = totalCollectedIQD - totalExpensesIQD;

  const paymentMethodLabels: Record<IraqiPaymentMethod, { ar: string; en: string }> = {
    cash_iqd: { ar: 'نقداً (Cash IQD)', en: 'Cash (IQD)' },
    zain_cash: { ar: 'زين كاش (ZainCash)', en: 'ZainCash Wallet' },
    qi_card: { ar: 'كي كارد / ماستر (QiCard)', en: 'QiCard / POS' },
    fib_transfer: { ar: 'مصرف العراق الأول (FIB)', en: 'FIB Transfer' },
  };

  return (
    <div
      className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Financial Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
            {isAr
              ? 'النظام المالي وحسابات العيادة بالدينار العراقي (IQD / د.ع)'
              : 'Iraqi Clinic Financial Ledger & Billing System (IQD)'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'إدارة فواتير الجلسات المفردة، باقات التأهيل (الكورسات)، الدفعات النقدية الجزئية، سجل ديون المرضى، ومصاريف العيادة.'
              : 'Manage single-session invoices, multi-session packages, partial cash payments, patient debt ledger, and clinic expenses.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setShowNewExpenseForm(!showNewExpenseForm);
              setShowNewInvoiceForm(false);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>{isAr ? '+ تسجيل مصروف عيادة' : '+ Log Expense'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleInvoicePresetChange('single_session');
              setShowNewInvoiceForm(!showNewInvoiceForm);
              setShowNewExpenseForm(false);
            }}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? '+ إصدار فاتورة / كورس جديد (IQD)' : '+ New Invoice / Package (IQD)'}</span>
          </button>
        </div>
      </div>

      {/* 4-Column Iraqi Dinar Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'إجمالي الفواتير الصادرة (الصافي)' : 'Total Net Billed (IQD)'}
          </span>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-1">
            {formatIQD(totalBilledIQD, isAr)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {invoices.length} {isAr ? 'فاتورة مسجلة' : 'invoices'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'المقبوضات الفعلية بالصندوق' : 'Total Cash Collected (IQD)'}
          </span>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
            {formatIQD(totalCollectedIQD, isAr)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isAr ? 'نقداً + زين كاش + كي كارد' : 'Cash + ZainCash + QiCard'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'إجمالي ديون المرضى المتبقية' : 'Outstanding Patient Debt (IQD)'}
          </span>
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-1">
            {formatIQD(totalDebtIQD, isAr)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {invoices.filter((i) => i.balanceDueIQD > 0).length}{' '}
            {isAr ? 'مرضى بذمتهم مبالغ متبقية' : 'accounts with balance due'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'صافي ربح العيادة (بعد المصاريف)' : 'Net Clinic Profit (IQD)'}
          </span>
          <p className="text-xl font-extrabold text-teal-600 dark:text-teal-400 font-mono tabular-nums mt-1">
            {formatIQD(netProfitIQD, isAr)}
          </p>
          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 font-mono tabular-nums">
            {isAr ? 'المصاريف: ' : 'Expenses: '}
            {formatIQD(totalExpensesIQD, isAr)}
          </p>
        </div>
      </div>

      {/* New Invoice / Rehab Package Form */}
      {showNewInvoiceForm && (
        <form
          onSubmit={handleCreateInvoice}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-teal-300 dark:border-teal-800 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAr ? 'إصدار فاتورة علاج طبيعي أو باقة جلسات (IQD)' : 'Create New IQD Invoice or Package'}
            </h3>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'single_session', ar: 'جلسة مفردة (25,000 د.ع)', en: 'Single Session (25k)' },
                  { id: 'rehab_package', ar: 'كورس 10 جلسات (225,000 د.ع)', en: '10-Session Package' },
                  { id: 'evaluation', ar: 'فحص وتقييم أولي (35,000 د.ع)', en: 'Initial Eval (35k)' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleInvoicePresetChange(preset.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    invType === preset.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isAr ? preset.ar : preset.en}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'اختيار مريض مسجل:' : 'Select Patient:'}
              </label>
              <select
                value={invPatientId}
                onChange={(e) => setInvPatientId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">{isAr ? '-- أو اكتب اسم المريض --' : '-- Or enter name --'}</option>
                {activePatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.data.fullName}
                  </option>
                ))}
              </select>
            </div>

            {!invPatientId && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {isAr ? 'اسم المريض:' : 'Patient Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={invCustomName}
                  onChange={(e) => setInvCustomName(e.target.value)}
                  placeholder={isAr ? 'الاسم الكامل...' : 'Full Name...'}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'بيان الخدمة العلاجية:' : 'Service Description:'}
              </label>
              <input
                type="text"
                value={invTitle}
                onChange={(e) => setInvTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'المبلغ الكلي (د.ع):' : 'Total Amount (IQD):'}
              </label>
              <input
                type="number"
                step="1000"
                value={invTotalIQD}
                onChange={(e) => setInvTotalIQD(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'الخصم الممنوح (د.ع):' : 'Discount (IQD):'}
              </label>
              <input
                type="number"
                step="1000"
                value={invDiscountIQD}
                onChange={(e) => setInvDiscountIQD(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                {isAr ? 'المبلغ المقبوض الآن (د.ع):' : 'Amount Paid Today (IQD):'}
              </label>
              <input
                type="number"
                step="1000"
                value={invPaidIQD}
                onChange={(e) => setInvPaidIQD(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'طريقة الدفع:' : 'Payment Method:'}
              </label>
              <select
                value={invMethod}
                onChange={(e) => setInvMethod(e.target.value as IraqiPaymentMethod)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {Object.entries(paymentMethodLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {isAr ? v.ar : v.en}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs font-mono tabular-nums space-x-4 rtl:space-x-reverse">
              <span className="text-slate-600 dark:text-slate-400">
                {isAr ? 'الصافي المطلوب: ' : 'Net Due: '}
                <strong className="text-slate-900 dark:text-white">
                  {formatIQD(Math.max(0, invTotalIQD - invDiscountIQD), isAr)}
                </strong>
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                {isAr ? 'المتبقي بذمة المريض (دين): ' : 'Remaining Balance (Debt): '}
                <strong>
                  {formatIQD(
                    Math.max(0, Math.max(0, invTotalIQD - invDiscountIQD) - invPaidIQD),
                    isAr
                  )}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewInvoiceForm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إصدار الفاتورة وحفظ الوصل' : 'Issue Invoice & Receipt'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* New Clinic Expense Form */}
      {showNewExpenseForm && (
        <form
          onSubmit={handleAddExpense}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-rose-300 dark:border-rose-800 space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isAr ? 'تسجيل مصروف تشغيلي للعيادة (IQD)' : 'Log Clinic Operating Expense (IQD)'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'تبويب المصروف:' : 'Category:'}
              </label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as ExpenseCategoryIQD)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="medical_consumables">{isAr ? 'مستلزمات طبية واستهلاكية' : 'Medical Consumables'}</option>
                <option value="equipment_maintenance">{isAr ? 'صيانة وشراء أجهزة علاج طبيعي' : 'Equipment & Maintenance'}</option>
                <option value="electricity_generator">{isAr ? 'كهرباء واشتراك المولدة' : 'Electricity & Generator'}</option>
                <option value="rent">{isAr ? 'إيجار العيادة' : 'Clinic Rent'}</option>
                <option value="staff_salaries">{isAr ? 'رواتب ومكافآت الكادر' : 'Staff Salaries'}</option>
                <option value="marketing_other">{isAr ? 'مصاريف إدارية أخرى' : 'Other Admin Expenses'}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'بيان المصروف:' : 'Description:'}
              </label>
              <input
                type="text"
                required
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                placeholder={isAr ? 'مثال: شراء لفافات مطاطية TheraBand...' : 'e.g., TheraBand rolls...'}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'المبلغ (د.ع):' : 'Amount (IQD):'}
              </label>
              <input
                type="number"
                step="1000"
                value={expAmountIQD}
                onChange={(e) => setExpAmountIQD(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewExpenseForm(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
            >
              {isAr ? 'حفظ المصروف' : 'Save Expense'}
            </button>
          </div>
        </form>
      )}

      {/* Partial Payment Collection Modal Inline Box */}
      {selectedInvoiceForPayment && (
        <form
          onSubmit={handleCollectPartialPayment}
          className="bg-emerald-50/70 dark:bg-emerald-950/30 p-5 rounded-2xl border border-emerald-300 dark:border-emerald-800 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr
                  ? `استلام دفعة مالية من المريض: ${selectedInvoiceForPayment.patientName}`
                  : `Collect Payment from: ${selectedInvoiceForPayment.patientName}`}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                {selectedInvoiceForPayment.invoiceNumber} ·{' '}
                {isAr ? 'المتبقي بالذمة: ' : 'Balance Due: '}
                {formatIQD(selectedInvoiceForPayment.balanceDueIQD, isAr)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedInvoiceForPayment(null)}
              className="text-xs font-bold text-slate-500 cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'المبلغ المستلم اليوم (د.ع):' : 'Payment Amount (IQD):'}
              </label>
              <input
                type="number"
                step="1000"
                max={selectedInvoiceForPayment.balanceDueIQD}
                value={paymentAmountIQD}
                onChange={(e) => setPaymentAmountIQD(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'وسيلة الدفع:' : 'Payment Method:'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as IraqiPaymentMethod)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {Object.entries(paymentMethodLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {isAr ? v.ar : v.en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isAr ? 'ملاحظات الوصل:' : 'Receipt Notes:'}
              </label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder={isAr ? 'مثال: الدفعة الثانية من الكورس...' : 'Second installment...'}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              {isAr ? 'تأكيد استلام الدفعة وإصدار وصل قبض' : 'Confirm Payment & Issue Receipt'}
            </button>
          </div>
        </form>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        {(
          [
            { id: 'invoices', ar: 'سجل الفواتير وباقات الجلسات', en: 'Invoices & Rehab Packages' },
            { id: 'debts', ar: 'دفتر ديون وذمم المرضى', en: 'Patient Debt Ledger' },
            { id: 'expenses', ar: 'مصاريف العيادة التشغيلية', en: 'Clinic Expenses' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isAr ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'expenses' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                <th className="py-3.5 px-4 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? 'البيان' : 'Description'}</th>
                <th className="py-3.5 px-4 text-start">{isAr ? 'المسجل' : 'Recorded By'}</th>
                <th className="py-3.5 px-4 text-end">{isAr ? 'المبلغ (د.ع)' : 'Amount (IQD)'}</th>
                <th className="py-3.5 px-4 text-end">{isAr ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {expenses.map((exp) => (
                <tr key={exp.id} className="tabular-nums">
                  <td className="py-3.5 px-4 font-mono text-slate-500">{exp.date}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                    {isAr ? exp.titleAr : exp.titleEn}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{exp.paidBy}</td>
                  <td className="py-3.5 px-4 text-end font-mono font-bold text-rose-600 dark:text-rose-400">
                    {formatIQD(exp.amountIQD, isAr)}
                  </td>
                  <td className="py-3.5 px-4 text-end">
                    {perms.canDeleteFinancialRecords && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpenses(ClinicOperationsService.deleteExpenseIQD(exp.id))
                        }
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                  <th className="py-3.5 px-4 text-start">{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'المريض والخدمة' : 'Patient & Service'}</th>
                  <th className="py-3.5 px-4 text-start">{isAr ? 'استهلاك الكورس' : 'Package Visits'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'الصافي (د.ع)' : 'Net (IQD)'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'المدفوع (د.ع)' : 'Paid (IQD)'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'المتبقي / الدين' : 'Balance Due'}</th>
                  <th className="py-3.5 px-4 text-end">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(activeTab === 'debts'
                  ? invoices.filter((i) => i.balanceDueIQD > 0)
                  : invoices
                ).map((inv) => (
                  <tr key={inv.id} className="tabular-nums hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      <div>{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-400">{inv.date}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {inv.patientName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isAr ? inv.titleAr : inv.titleEn}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {inv.packageTotalSessions ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                            {inv.packageUsedSessions || 0} / {inv.packageTotalSessions}
                          </span>
                          {(inv.packageUsedSessions || 0) < inv.packageTotalSessions && (
                            <button
                              type="button"
                              onClick={() =>
                                setInvoices(
                                  ClinicOperationsService.incrementPackageSessionUsed(inv.id)
                                )
                              }
                              className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-bold cursor-pointer"
                            >
                              {isAr ? '+ خصم جلسة' : '+1 Visit'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-end font-mono font-bold text-slate-900 dark:text-white">
                      {formatIQD(inv.netAmountIQD, isAr)}
                    </td>
                    <td className="py-3.5 px-4 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatIQD(inv.paidAmountIQD, isAr)}
                    </td>
                    <td className="py-3.5 px-4 text-end font-mono font-bold">
                      {inv.balanceDueIQD > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          {formatIQD(inv.balanceDueIQD, isAr)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {isAr ? 'مسدد بالكامل' : 'Paid in Full'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-end">
                      {inv.balanceDueIQD > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoiceForPayment(inv);
                            setPaymentAmountIQD(inv.balanceDueIQD);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          {isAr ? 'استلام دفعة (د.ع)' : 'Collect Payment'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
