import React, { useState } from 'react';
import {
  BarChart3,
  Users,
  CreditCard,
  TrendingDown,
  PieChart,
  Settings,
  GraduationCap,
  Wallet,
  BookOpen,
  Package
} from 'lucide-react';
import { FinanceDashboard } from './FinanceDashboard';
import { StudentAccounts } from './StudentAccounts';
import { LedgerManager } from './ExpenseManager';
import { PayrollManager } from './PayrollManager';
import { ScholarshipsManager } from './ScholarshipsManager';
import { FinanceSettings } from './FinanceSettings';
import { FinanceReports } from './FinanceReports';
import { InventoryManager } from './InventoryManager';

export const FinanceModule = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Resumen', icon: BarChart3 },
    { id: 'students', label: 'Cuentas Alumnos', icon: Users },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'expenses', label: 'Libro Contable', icon: BookOpen },
    { id: 'payroll', label: 'Nómina', icon: Wallet },
    { id: 'scholarships', label: 'Becas', icon: GraduationCap },
    { id: 'reports', label: 'Reportes', icon: PieChart },
    { id: 'settings', label: 'Configuración', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      {/* NAVEGACIÓN INTERNA DEL MÓDULO */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex gap-2 overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xl scale-105'
                : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* RENDERIZADO DE SUB-MÓDULOS */}
      <div className="animate-fade-in">
        {activeTab === 'dashboard' && <FinanceDashboard />}
        {activeTab === 'students' && <StudentAccounts onTabChange={setActiveTab} />}
        {activeTab === 'expenses' && <LedgerManager />}
        {activeTab === 'payroll' && <PayrollManager />}
        {activeTab === 'scholarships' && <ScholarshipsManager />}
        {activeTab === 'inventory' && <InventoryManager />}
        {activeTab === 'reports' && <FinanceReports />}
        {activeTab === 'settings' && <FinanceSettings />}
      </div>
    </div>
  );
};
