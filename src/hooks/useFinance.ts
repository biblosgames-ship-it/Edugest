import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { toast } from 'react-hot-toast';

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useFinance = (options?: {
  paymentPlans?: boolean;
  invoices?: boolean;
  transactions?: boolean;
  scholarships?: boolean;
  expenses?: boolean;
  suppliers?: boolean;
  payroll?: boolean;
  products?: boolean;
  ledger?: boolean;
}) => {
  const { profile } = useApp();
  const [loading, setLoading] = useState(true);
  const [paymentPlans, setPaymentPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [payrollConfigs, setPayrollConfigs] = useState<any[]>([]);
  const [payrollPayments, setPayrollPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ledgerCategories, setLedgerCategories] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);

  const centerId = profile?.center_id;

  const fetchPlans = options ? !!options.paymentPlans : true;
  const fetchInvoices = options ? !!options.invoices : true;
  const fetchTransactions = options ? !!options.transactions : true;
  const fetchScholarships = options ? !!options.scholarships : true;
  const fetchExpenses = options ? !!options.expenses : true;
  const fetchSuppliers = options ? !!options.suppliers : true;
  const fetchPayroll = options ? !!options.payroll : true;
  const fetchProducts = options ? !!options.products : true;
  const fetchLedger = options ? !!options.ledger : true;

  const fetchData = useCallback(async () => {
    if (!centerId) return;
    setLoading(true);
    try {
      const promises: any[] = [];
      const keys: string[] = [];

      if (fetchPlans) {
        promises.push(supabase.from('finance_payment_plans').select('*').eq('center_id', centerId));
        keys.push('plans');
      }
      if (fetchInvoices) {
        promises.push(
          supabase
            .from('finance_invoices')
            .select('*')
            .eq('center_id', centerId)
            .order('due_date', { ascending: true })
            .limit(1000)
        );
        keys.push('invoices');
      }
      if (fetchTransactions) {
        promises.push(
          supabase
            .from('finance_transactions')
            .select('*, students(names, first_surname)')
            .eq('center_id', centerId)
            .order('created_at', { ascending: false })
            .limit(500)
        );
        keys.push('transactions');
      }
      if (fetchScholarships) {
        promises.push(
          supabase
            .from('finance_scholarships')
            .select('*, students(names, first_surname, second_surname)')
            .eq('center_id', centerId)
        );
        keys.push('scholarships');
      }
      if (fetchExpenses) {
        promises.push(
          supabase
            .from('finance_expenses')
            .select('*, finance_suppliers(name)')
            .eq('center_id', centerId)
            .order('expense_date', { ascending: false })
        );
        keys.push('expenses');
      }
      if (fetchSuppliers) {
        promises.push(supabase.from('finance_suppliers').select('*').eq('center_id', centerId));
        keys.push('suppliers');
      }
      if (fetchPayroll) {
        promises.push(
          supabase.from('finance_payroll_config').select('*, staff(name)').eq('center_id', centerId)
        );
        keys.push('payroll_config');
        promises.push(
          supabase
            .from('finance_payroll_payments')
            .select('*, staff(name)')
            .eq('center_id', centerId)
            .order('created_at', { ascending: false })
        );
        keys.push('payroll_payments');
      }
      if (fetchProducts) {
        promises.push(
          supabase
            .from('finance_products')
            .select('*')
            .eq('center_id', centerId)
            .order('name', { ascending: true })
        );
        keys.push('products');
      }
      if (fetchLedger) {
        promises.push(
          supabase
            .from('finance_ledger_categories')
            .select('*')
            .eq('center_id', centerId)
            .order('name', { ascending: true })
        );
        keys.push('ledger_categories');
        promises.push(
          supabase
            .from('finance_ledger_entries')
            .select('*')
            .eq('center_id', centerId)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
        );
        keys.push('ledger_entries');
      }

      if (promises.length === 0) {
        setLoading(false);
        return;
      }

      const results = await Promise.all(promises);

      results.forEach((res, index) => {
        const key = keys[index];
        if (res.error) {
          console.error(`Error loading ${key}:`, res.error);
          return;
        }

        if (key === 'plans') setPaymentPlans(res.data || []);
        else if (key === 'invoices') setInvoices(res.data || []);
        else if (key === 'transactions') setTransactions(res.data || []);
        else if (key === 'scholarships') setScholarships(res.data || []);
        else if (key === 'expenses') setExpenses(res.data || []);
        else if (key === 'suppliers') setSuppliers(res.data || []);
        else if (key === 'payroll_config') setPayrollConfigs(res.data || []);
        else if (key === 'payroll_payments') setPayrollPayments(res.data || []);
        else if (key === 'products') setProducts(res.data || []);
        else if (key === 'ledger_categories') setLedgerCategories(res.data || []);
        else if (key === 'ledger_entries') setLedgerEntries(res.data || []);
      });
    } catch (error) {
      console.error('Error fetching finance data:', error);
      toast.error('Error al cargar datos financieros');
    } finally {
      setLoading(false);
    }
  }, [
    centerId,
    fetchPlans,
    fetchInvoices,
    fetchTransactions,
    fetchScholarships,
    fetchExpenses,
    fetchSuppliers,
    fetchPayroll,
    fetchProducts,
    fetchLedger
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // LOG AUDITORÍA
  const logAction = async (type: string, module: string, recordId: string, description: string) => {
    if (!centerId) return;
    await supabase.from('finance_audit_log').insert({
      center_id: centerId,
      action_type: type,
      module,
      record_id: recordId,
      description,
      performed_by: profile?.id
    });
  };

  // MÉTODOS DE MUTACIÓN
  const savePaymentPlan = async (planOrPlans: any | any[]) => {
    const currentCenterId = centerId || profile?.center_id;

    if (!currentCenterId) {
      toast.error('Error: No se encontró la identificación del centro');
      return;
    }

    try {
      const isArray = Array.isArray(planOrPlans);
      if (isArray && planOrPlans.length === 0) {
        toast.error('No hay cursos en este nivel para configurar');
        return;
      }

      const plansToSave = isArray
        ? planOrPlans.map((p) => ({ ...p, center_id: currentCenterId }))
        : { ...planOrPlans, center_id: currentCenterId };

      const { data, error } = await supabase
        .from('finance_payment_plans')
        .upsert(plansToSave, { onConflict: 'course_id' })
        .select();

      if (error) {
        console.error('Supabase Error:', error);
        throw new Error(error.message);
      }

      if (data && data.length > 0) {
        await logAction(
          'upsert',
          'payment_plans',
          data[0].id,
          `Planes de pago actualizados (${data.length} registros)`
        );
        toast.success('¡Precios aplicados correctamente!');
      }

      await fetchData();
      return data;
    } catch (error: any) {
      console.error('Error saving payment plan:', error);
      toast.error(`Error al guardar: ${error.message || 'Error desconocido'}`);
      throw error;
    }
  };

  const registerPayment = async (paymentData: any) => {
    try {
      // 1. Registrar transacción
      const { data: trans, error: tErr } = await supabase
        .from('finance_transactions')
        .insert({ ...paymentData, center_id: centerId })
        .select();

      if (tErr) throw tErr;
      const transRow = trans[0];

      // 2. Actualizar factura si aplica
      let invRow: any = null;
      if (paymentData.invoice_id) {
        const { data: inv } = await supabase
          .from('finance_invoices')
          .select('*')
          .eq('id', paymentData.invoice_id)
          .single();
        invRow = inv;
        const newStatus = paymentData.amount_paid >= inv.amount_final ? 'paid' : 'partial';
        await supabase
          .from('finance_invoices')
          .update({ status: newStatus })
          .eq('id', paymentData.invoice_id);
      }

      // === REGISTRO AUTOMÁTICO EN EL LIBRO CONTABLE (DB) ===
      if (transRow) {
        try {
          let studentName = 'Alumno';
          const { data: std } = await supabase
            .from('students')
            .select('names, first_surname')
            .eq('id', paymentData.student_id)
            .single();
          if (std) {
            studentName = `${std.names} ${std.first_surname || ''}`.trim();
          }

          const invConcept = invRow?.concept || paymentData.notes || 'Cobro';
          const isEnrollment = invConcept.toLowerCase().includes('inscrip');
          const accountName = isEnrollment ? 'INGRESOS: INSCRIPCIONES' : 'INGRESOS: COLEGIATURAS';

          await supabase.from('finance_ledger_entries').insert({
            center_id: centerId || profile?.center_id,
            transaction_id: transRow.id,
            date: getLocalDateString(),
            account: accountName,
            item: studentName,
            description: `Cobro de: ${invConcept} (Recibo #${transRow.receipt_number || 'S/N'})`,
            type: 'income',
            amount: Number(paymentData.amount_paid),
            method: paymentData.payment_method
          });
        } catch (e) {
          console.error('Error auto-syncing transaction with ledger:', e);
        }
      }

      await logAction(
        'create',
        'payments',
        transRow.id,
        `Pago registrado de ${paymentData.amount_paid}`
      );
      fetchData();
      toast.success('Pago registrado con éxito');
      return transRow;
    } catch (error) {
      toast.error('Error al registrar pago');
      throw error;
    }
  };

  const saveScholarship = async (scholarship: any) => {
    const currentCenterId = centerId || profile?.center_id;

    if (!currentCenterId) {
      toast.error('Error: No se detecta el ID del centro');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('finance_scholarships')
        .upsert({ ...scholarship, center_id: currentCenterId }, { onConflict: 'student_id' })
        .select();

      if (error) {
        console.error('Scholarship Save Error:', error);
        throw new Error(error.message);
      }

      // Aplicar el descuento a las facturas pendientes
      await applyScholarshipToInvoices(scholarship.student_id, scholarship);

      await logAction(
        'upsert',
        'scholarships',
        data[0].id,
        `Beca actualizada para alumno ${scholarship.student_id}`
      );
      fetchData();
      toast.success('¡Beneficio aplicado correctamente!');
      return data[0];
    } catch (error: any) {
      console.error('Error saving scholarship:', error);
      toast.error(`Error al guardar beca: ${error.message || 'Error desconocido'}`);
      throw error;
    }
  };

  const applyScholarshipToInvoices = async (studentId: string, scholarship: any) => {
    try {
      // Obtener facturas pendientes del alumno
      const { data: invs } = await supabase
        .from('finance_invoices')
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'pending');

      if (!invs) return;

      for (const inv of invs) {
        let newAmount = Number(inv.amount_original);
        let discount = 0;

        // Solo aplicar si aplica a este concepto
        const isEnrollment = inv.concept.toLowerCase().includes('inscripción');
        const isMonthly = inv.concept.toLowerCase().includes('mensualidad');

        const shouldApply =
          scholarship.applies_to === 'both' ||
          (scholarship.applies_to === 'enrollment' && isEnrollment) ||
          (scholarship.applies_to === 'monthly' && isMonthly);

        if (shouldApply) {
          if (scholarship.type === 'percentage') {
            discount = newAmount * (Number(scholarship.value) / 100);
          } else {
            discount = Number(scholarship.value);
          }
          newAmount = Math.max(0, newAmount - discount);

          await supabase
            .from('finance_invoices')
            .update({
              amount_final: newAmount,
              discount_applied: discount
            })
            .eq('id', inv.id);
        }
      }
    } catch (error) {
      console.error('Error applying scholarship to invoices:', error);
    }
  };

  const voidPayment = async (transactionId: string) => {
    if (
      !window.confirm(
        '¿Estás seguro de que deseas ANULAR este pago? El recibo desaparecerá y las facturas volverán a estar pendientes.'
      )
    )
      return;

    setLoading(true);
    try {
      // 1. Obtener datos de la transacción original para saber qué factura reabrir
      const { data: trans, error: gErr } = await supabase
        .from('finance_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (gErr) throw gErr;

      // 2. Buscar todas las transacciones que comparten el mismo receipt_number
      let targetTransactions = [trans];
      if (trans.receipt_number) {
        const { data: siblingTrans } = await supabase
          .from('finance_transactions')
          .select('*')
          .eq('receipt_number', trans.receipt_number)
          .eq('center_id', centerId);
        if (siblingTrans && siblingTrans.length > 0) {
          targetTransactions = siblingTrans;
        }
      }

      // 3. Para cada transacción, volver a poner la factura en 'pending'
      for (const t of targetTransactions) {
        if (t.invoice_id) {
          await supabase
            .from('finance_invoices')
            .update({ status: 'pending' })
            .eq('id', t.invoice_id);
        }
      }

      // 4. Borrar todas las transacciones agrupadas
      const targetIds = targetTransactions.map((t) => t.id);
      const { error: dErr } = await supabase
        .from('finance_transactions')
        .delete()
        .in('id', targetIds);

      if (dErr) throw dErr;

      const totalAmount = targetTransactions.reduce((acc, t) => acc + Number(t.amount_paid), 0);
      await logAction(
        'delete',
        'payments',
        transactionId,
        `Pago anulado (Recibo: ${trans.receipt_number || 'S/N'}, Monto Total: ${totalAmount})`
      );
      toast.success('Pago anulado exitosamente');
      await fetchData();
    } catch (error: any) {
      console.error('Error voiding payment:', error);
      toast.error('Error al anular el pago: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // PRODUCTOS DE INVENTARIO
  const saveProduct = async (product: any) => {
    const currentCenterId = centerId || profile?.center_id;
    if (!currentCenterId) {
      toast.error('Error: No se encontró la identificación del centro');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('finance_products')
        .upsert({ ...product, center_id: currentCenterId })
        .select();

      if (error) throw error;
      toast.success(product.id ? '¡Producto actualizado!' : '¡Producto agregado!');
      await fetchData();
      return data?.[0];
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(`Error al guardar producto: ${error.message || 'Error desconocido'}`);
      throw error;
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este producto del inventario?'))
      return;
    try {
      const { error } = await supabase.from('finance_products').delete().eq('id', productId);

      if (error) throw error;
      toast.success('Producto eliminado del inventario');
      await fetchData();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar producto: ' + error.message);
      throw error;
    }
  };

  const createProductInvoice = async (invoiceData: {
    student_id: string;
    items: Array<{
      product_id: string;
      concept: string;
      amount: number;
      quantity: number;
    }>;
    payment_method?: string;
    reference_number?: string;
    notes?: string;
  }) => {
    const currentCenterId = centerId || profile?.center_id;
    if (!currentCenterId) {
      toast.error('Error: No se encontró la identificación del centro');
      return;
    }
    try {
      // 1. Preparar e Insertar Facturas
      const invoicesToInsert = invoiceData.items.map((item) => ({
        center_id: currentCenterId,
        student_id: invoiceData.student_id,
        product_id: item.product_id,
        quantity: item.quantity,
        concept: item.concept,
        amount_original: item.amount,
        amount_final: item.amount,
        due_date: new Date().toISOString().split('T')[0],
        status: invoiceData.payment_method ? 'paid' : 'pending',
        period: '2026-2027',
        description: `Venta de Producto x${item.quantity}`
      }));

      const { data: invs, error: invErr } = await supabase
        .from('finance_invoices')
        .insert(invoicesToInsert)
        .select();

      if (invErr) throw invErr;

      // 2. Si es pago inmediato, registrar transacción y sincronizar libro consolidado
      if (invoiceData.payment_method && invs && invs.length > 0) {
        const transactionsToInsert = invs.map((inv) => ({
          center_id: currentCenterId,
          student_id: invoiceData.student_id,
          invoice_id: inv.id,
          amount_paid: inv.amount_final,
          payment_method: invoiceData.payment_method,
          reference_number: invoiceData.reference_number || '',
          notes: invoiceData.notes || `Cobro de venta de producto: ${inv.concept}`
        }));

        const { data: transRows, error: tErr } = await supabase
          .from('finance_transactions')
          .insert(transactionsToInsert)
          .select();

        if (tErr) throw tErr;

        // === REGISTRO AUTOMÁTICO EN EL LIBRO CONTABLE (DB) ===
        if (transRows && transRows.length > 0) {
          try {
            let studentName = 'Venta de Productos';
            const { data: std } = await supabase
              .from('students')
              .select('names, first_surname')
              .eq('id', invoiceData.student_id)
              .single();
            if (std) {
              studentName = `${std.names} ${std.first_surname || ''}`.trim();
            }

            const ledgerEntriesToInsert = transRows.map((transRow, index) => {
              const inv = invs[index];
              const itemConcept = inv.concept.startsWith('Venta: ')
                ? inv.concept.replace('Venta: ', '')
                : inv.concept;

              const prod = products.find((p) => p.id === inv.product_id);
              const category = prod?.category || 'other';

              let accountName = 'INGRESOS: INVENTARIO (OTROS)';
              if (category === 'uniform') accountName = 'INGRESOS: UNIFORMES';
              else if (category === 'book') accountName = 'INGRESOS: LIBROS';
              else if (category === 'material') accountName = 'INGRESOS: MATERIALES';

              return {
                center_id: currentCenterId,
                transaction_id: transRow.id,
                date: getLocalDateString(),
                account: accountName,
                item: studentName,
                description: `Venta: ${inv.quantity}x ${itemConcept} [MÉTODO: ${invoiceData.payment_method!.toUpperCase()}]`,
                type: 'income',
                amount: Number(inv.amount_final),
                method: invoiceData.payment_method
              };
            });

            await supabase.from('finance_ledger_entries').insert(ledgerEntriesToInsert);
          } catch (e) {
            console.error('Error auto-syncing product sale with ledger:', e);
          }
        }
      }

      toast.success(
        invoiceData.payment_method
          ? '¡Venta registrada y cobrada con éxito!'
          : '¡Facturas de producto generadas!'
      );
      await fetchData();
      return invs;
    } catch (error: any) {
      console.error('Error in createProductInvoice:', error);
      toast.error('Error al facturar productos: ' + error.message);
      throw error;
    }
  };

  // MUTADORES DEL LIBRO CONTABLE
  const saveLedgerCategory = async (category: any) => {
    const currentCenterId = centerId || profile?.center_id;
    if (!currentCenterId) {
      toast.error('Error: No se encontró la identificación del centro');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('finance_ledger_categories')
        .upsert({ ...category, center_id: currentCenterId })
        .select();

      if (error) throw error;
      await fetchData();
      return data?.[0];
    } catch (error: any) {
      console.error('Error saving ledger category:', error);
      toast.error(`Error al guardar categoría contable: ${error.message}`);
      throw error;
    }
  };

  const deleteLedgerCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('finance_ledger_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      console.error('Error deleting ledger category:', error);
      toast.error('Error al eliminar categoría contable: ' + error.message);
      throw error;
    }
  };

  const saveLedgerEntry = async (entry: any) => {
    const currentCenterId = centerId || profile?.center_id;
    if (!currentCenterId) {
      toast.error('Error: No se encontró la identificación del centro');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('finance_ledger_entries')
        .upsert({ ...entry, center_id: currentCenterId })
        .select();

      if (error) throw error;
      await fetchData();
      return data?.[0];
    } catch (error: any) {
      console.error('Error saving ledger entry:', error);
      toast.error(`Error al guardar movimiento contable: ${error.message}`);
      throw error;
    }
  };

  const deleteLedgerEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('finance_ledger_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      console.error('Error deleting ledger entry:', error);
      toast.error('Error al eliminar movimiento contable: ' + error.message);
      throw error;
    }
  };

  return {
    loading,
    paymentPlans,
    invoices,
    transactions,
    scholarships,
    expenses,
    suppliers,
    payrollConfigs,
    payrollPayments,
    products,
    ledgerCategories,
    ledgerEntries,
    savePaymentPlan,
    registerPayment,
    voidPayment,
    saveScholarship,
    saveProduct,
    deleteProduct,
    createProductInvoice,
    saveLedgerCategory,
    deleteLedgerCategory,
    saveLedgerEntry,
    deleteLedgerEntry,
    refresh: fetchData
  };
};
