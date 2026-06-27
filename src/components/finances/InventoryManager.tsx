import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Package,
  DollarSign,
  AlertTriangle,
  Check,
  ShoppingCart,
  Users
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { useFinance } from '../../hooks/useFinance';
import { PaymentModal } from './PaymentModal';

export const InventoryManager = () => {
  const { state } = useApp();
  const { products, saveProduct, deleteProduct, createProductInvoice, loading } = useFinance({ products: true });

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modales
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [showSaleModal, setShowSaleModal] = useState(false);

  // Formulario Producto
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    category: 'uniform',
    price: 0,
    cost: 0,
    stock: 0,
    min_stock: 5
  });

  // Formulario Venta (Carrito)
  const [saleForm, setSaleForm] = useState({
    student_id: '',
    immediate_pay: true,
    payment_method: 'cash',
    reference_number: '',
    notes: ''
  });

  const [cart, setCart] = useState<
    Array<{
      product_id: string;
      name: string;
      quantity: number;
      price: number;
      total: number;
    }>
  >([]);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [receiptStudent, setReceiptStudent] = useState<any>(null);
  const [receiptInvoices, setReceiptInvoices] = useState<any[] | null>(null);

  // Estadísticas del Inventario
  const stats = useMemo(() => {
    const totalItems = products.length;
    const lowStockItems = products.filter((p) => p.stock <= p.min_stock).length;
    const totalValuation = products.reduce((acc, p) => acc + p.stock * p.price, 0);
    const totalCost = products.reduce((acc, p) => acc + p.stock * p.cost, 0);
    return { totalItems, lowStockItems, totalValuation, totalCost };
  }, [products]);

  // Filtrado de Productos
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  // Filtrado de Alumnos para la Venta
  const filteredStudents = useMemo(() => {
    if (studentSearchTerm.length < 2) return [];
    return (state.students || [])
      .filter((s) => {
        const fullName = `${s.names} ${s.first_surname} ${s.second_surname || ''}`.toLowerCase();
        return fullName.includes(studentSearchTerm.toLowerCase());
      })
      .slice(0, 10);
  }, [state.students, studentSearchTerm]);

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      sku: '',
      name: '',
      category: 'uniform',
      price: 0,
      cost: 0,
      stock: 0,
      min_stock: 5
    });
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (prod: any) => {
    setEditingProduct(prod);
    setProductForm({
      sku: prod.sku || '',
      name: prod.name,
      category: prod.category,
      price: Number(prod.price),
      cost: Number(prod.cost),
      stock: Number(prod.stock),
      min_stock: Number(prod.min_stock)
    });
    setShowProductModal(true);
  };

  const handleSaveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name) return toast.error('El nombre del producto es requerido');
    if (productForm.price < 0 || productForm.cost < 0 || productForm.stock < 0) {
      return toast.error('Los montos y cantidades no pueden ser negativos');
    }

    try {
      await saveProduct({
        ...(editingProduct ? { id: editingProduct.id } : {}),
        ...productForm
      });
      setShowProductModal(false);
    } catch (err) {
      // toast ya se maneja en el hook
    }
  };

  const handleOpenSale = () => {
    setSaleForm({
      student_id: '',
      immediate_pay: true,
      payment_method: 'cash',
      reference_number: '',
      notes: ''
    });
    setCart([]);
    setSelectedProductId('');
    setSelectedQuantity(1);
    setStudentSearchTerm('');
    setShowSaleModal(true);
  };

  const handleAddToCart = () => {
    if (!selectedProductId) return toast.error('Selecciona un producto');
    if (selectedQuantity <= 0) return toast.error('La cantidad debe ser mayor a 0');

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return toast.error('Producto no encontrado');

    const existingIdx = cart.findIndex((item) => item.product_id === selectedProductId);
    const qtyInCart = existingIdx > -1 ? cart[existingIdx].quantity : 0;
    const finalQty = qtyInCart + selectedQuantity;

    if (product.stock < finalQty) {
      toast.error(`Stock insuficiente. Solo quedan ${product.stock} unidades.`);
      return;
    }

    if (existingIdx > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIdx].quantity = finalQty;
      updatedCart[existingIdx].total = finalQty * Number(product.price);
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          product_id: selectedProductId,
          name: product.name,
          quantity: selectedQuantity,
          price: Number(product.price),
          total: selectedQuantity * Number(product.price)
        }
      ]);
    }

    setSelectedProductId('');
    setSelectedQuantity(1);
    toast.success('Añadido a la canasta');
  };

  const handleRemoveFromCart = (prodId: string) => {
    setCart(cart.filter((item) => item.product_id !== prodId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.total, 0);
  }, [cart]);

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm.student_id) return toast.error('Selecciona un estudiante');
    if (cart.length === 0) return toast.error('La canasta está vacía. Añade al menos un producto.');

    try {
      const items = cart.map((item) => ({
        product_id: item.product_id,
        concept: `Venta: ${item.name}`,
        amount: item.total,
        quantity: item.quantity
      }));

      const invs = await createProductInvoice({
        student_id: saleForm.student_id,
        items,
        ...(saleForm.immediate_pay
          ? {
              payment_method: saleForm.payment_method,
              reference_number: saleForm.reference_number,
              notes: saleForm.notes || 'Cobro de venta de inventario'
            }
          : {})
      });
      setShowSaleModal(false);
      setCart([]);
      
      if (saleForm.immediate_pay && invs && invs.length > 0) {
        const studentObj = state.students.find((s) => s.id === saleForm.student_id);
        if (studentObj) {
          setReceiptStudent(studentObj);
          setReceiptInvoices(invs);
        }
      }
    } catch (err) {
      // Error se maneja en el hook
    }
  };

  const selectedProductForAdding = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const selectedStudentForSaleObj = useMemo(() => {
    return state.students.find((s) => s.id === saleForm.student_id);
  }, [state.students, saleForm.student_id]);

  const categoryNames: { [key: string]: string } = {
    uniform: 'Uniforme',
    book: 'Libro',
    material: 'Material',
    other: 'Otro'
  };

  return (
    <div className="space-y-8">
      {/* TARJETA DE CABECERA Y ACCIONES */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-slate-900/20">
            <Package size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Inventario Escolar</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Gestión de uniformes, libros y materiales
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleOpenSale}
            className="flex items-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:scale-105 transition-all"
          >
            <ShoppingCart size={18} /> Nueva Venta
          </button>
          <button
            onClick={handleOpenAddProduct}
            className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
          >
            <Plus size={18} /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* ESTADÍSTICAS DEL INVENTARIO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="p-4 bg-slate-100 text-slate-900 rounded-2xl">
            <Package size={24} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Total Productos
            </p>
            <h4 className="text-3xl font-black text-slate-900">{stats.totalItems}</h4>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div
            className={`p-4 rounded-2xl ${stats.lowStockItems > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-emerald-50 text-emerald-600'}`}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Bajo Stock / Agotado
            </p>
            <h4
              className={`text-3xl font-black ${stats.lowStockItems > 0 ? 'text-rose-600' : 'text-slate-900'}`}
            >
              {stats.lowStockItems}
            </h4>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Valor Venta Stock
            </p>
            <h4 className="text-3xl font-black text-slate-900">
              RD$ {stats.totalValuation.toLocaleString()}
            </h4>
          </div>
        </div>
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
          />
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 w-full md:w-auto shrink-0">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
            Categoría
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white border-none text-[10px] font-black uppercase rounded-xl px-4 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500 w-44"
          >
            <option value="all">Todas las Categorías</option>
            <option value="uniform">Uniformes</option>
            <option value="book">Libros</option>
            <option value="material">Materiales</option>
            <option value="other">Otros</option>
          </select>
        </div>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-20 text-center space-y-4">
            <Package size={48} className="text-slate-200 mx-auto" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              No se encontraron productos en el inventario.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-8 py-5">SKU</th>
                  <th className="px-8 py-5">Nombre del Producto</th>
                  <th className="px-8 py-5">Categoría</th>
                  <th className="px-8 py-5 text-right">Costo (Adq.)</th>
                  <th className="px-8 py-5 text-right">Precio Venta</th>
                  <th className="px-8 py-5 text-center">Stock Disponible</th>
                  <th className="px-8 py-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProducts.map((prod) => {
                  const isLowStock = prod.stock <= prod.min_stock;
                  const isOutOfStock = prod.stock === 0;

                  return (
                    <tr key={prod.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-8 py-4">
                        <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-mono font-black uppercase">
                          {prod.sku || 'SIN SKU'}
                        </span>
                      </td>
                      <td className="px-8 py-4 font-black text-slate-800 text-xs">{prod.name}</td>
                      <td className="px-8 py-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                          {categoryNames[prod.category] || prod.category}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right font-bold text-slate-400 text-xs">
                        RD$ {Number(prod.cost).toLocaleString()}
                      </td>
                      <td className="px-8 py-4 text-right font-black text-slate-900 text-xs">
                        RD$ {Number(prod.price).toLocaleString()}
                      </td>
                      <td className="px-8 py-4 text-center">
                        <span
                          className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-600'
                              : isLowStock
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          {prod.stock} / {prod.min_stock} min
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditProduct(prod)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Editar Producto"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => deleteProduct(prod.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            title="Eliminar Producto"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: AGREGAR / EDITAR PRODUCTO */}
      {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase tracking-tighter">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveProductSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    SKU (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: UN-M"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Categoría
                  </label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="uniform">Uniforme</option>
                    <option value="book">Libro</option>
                    <option value="material">Material</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Polo Uniforme Talla M"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Costo de Adquisición (RD$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.cost}
                    onChange={(e) =>
                      setProductForm({ ...productForm, cost: Number(e.target.value) })
                    }
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Precio de Venta (RD$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.price}
                    onChange={(e) =>
                      setProductForm({ ...productForm, price: Number(e.target.value) })
                    }
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Stock Inicial / Actual
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.stock}
                    onChange={(e) =>
                      setProductForm({ ...productForm, stock: Number(e.target.value) })
                    }
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Stock Mínimo Alerta
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.min_stock}
                    onChange={(e) =>
                      setProductForm({ ...productForm, min_stock: Number(e.target.value) })
                    }
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-4 bg-slate-100 rounded-2xl text-xs font-black uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA VENTA / FACTURA DIRECTA (CARRITO) */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-black uppercase tracking-tighter">
                Registrar Venta / Factura
              </h3>
              <button
                onClick={() => setShowSaleModal(false)}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={handleSaleSubmit}
              className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 text-left"
            >
              {/* Buscador Alumno */}
              <div className="space-y-1 relative">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Users size={12} className="text-indigo-500" /> Estudiante
                </label>
                {selectedStudentForSaleObj ? (
                  <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                    <div>
                      <p className="text-xs font-black text-indigo-900">
                        {selectedStudentForSaleObj.names} {selectedStudentForSaleObj.first_surname}
                      </p>
                      <p className="text-[9px] font-bold text-indigo-500 uppercase">
                        Estudiante Activo
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSaleForm({ ...saleForm, student_id: '' })}
                      className="p-1 hover:bg-indigo-100 rounded-lg text-indigo-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Escribe el nombre del alumno para buscar..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                    />
                    {filteredStudents.length > 0 && (
                      <div className="absolute left-0 right-0 top-full bg-white border border-slate-100 rounded-2xl shadow-xl z-20 mt-1 max-h-48 overflow-y-auto divide-y divide-slate-50">
                        {filteredStudents.map((student) => (
                          <div
                            key={student.id}
                            onClick={() => {
                              setSaleForm({ ...saleForm, student_id: student.id });
                              setStudentSearchTerm('');
                            }}
                            className="p-4 hover:bg-indigo-50 cursor-pointer text-xs font-bold text-slate-700"
                          >
                            {student.names} {student.first_surname} {student.second_surname || ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sección Agregar Producto al Carrito */}
              <div className="border border-slate-100 rounded-3xl p-5 bg-slate-50/50 space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-400">Añadir Productos</p>
                <div className="space-y-3">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-6 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="">-- Seleccionar Producto --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (RD$ {Number(p.price).toLocaleString()} • Stock: {p.stock})
                      </option>
                    ))}
                  </select>

                  {selectedProductForAdding && (
                    <div className="flex gap-4 items-center">
                      <div className="w-1/3">
                        <label className="text-[8px] font-black text-slate-400 uppercase">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={selectedQuantity}
                          onChange={(e) => setSelectedQuantity(Math.max(1, Number(e.target.value)))}
                          className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                      <div className="flex-1 text-right pr-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Subtotal</p>
                        <p className="text-sm font-black text-slate-700">
                          RD${' '}
                          {(
                            Number(selectedProductForAdding.price) * selectedQuantity
                          ).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all self-end"
                      >
                        Añadir
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* LISTADO DE LA CANASTA (CARRITO) */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-black uppercase text-slate-400">Canasta de Compra</p>
                {cart.length === 0 ? (
                  <p className="text-center text-[10px] text-slate-300 py-6 uppercase font-bold italic border border-dashed border-slate-200 rounded-2xl">
                    La canasta está vacía
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {cart.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"
                      >
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase">
                            {item.quantity}x {item.name}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">
                            Unit: RD$ {item.price.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-xs font-black text-slate-900">
                            RD$ {item.total.toLocaleString()}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.product_id)}
                            className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total General */}
              {cart.length > 0 && (
                <div className="bg-slate-900 p-6 rounded-[2rem] flex justify-between items-center text-white shadow-xl shrink-0">
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-50">Total Venta</p>
                    <p className="text-xl font-black">RD$ {cartTotal.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase opacity-50">
                      {cart.length} Productos diferentes
                    </p>
                  </div>
                </div>
              )}

              {/* Checkbox Pago Inmediato */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                <input
                  type="checkbox"
                  id="immediate_pay"
                  checked={saleForm.immediate_pay}
                  onChange={(e) => setSaleForm({ ...saleForm, immediate_pay: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="immediate_pay"
                  className="text-xs font-black text-slate-700 cursor-pointer select-none uppercase tracking-wide"
                >
                  ¿Registrar Cobro de Inmediato?
                </label>
              </div>

              {/* Desglose de Pago Inmediato */}
              {saleForm.immediate_pay && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">
                        Método de Pago
                      </label>
                      <select
                        value={saleForm.payment_method}
                        onChange={(e) =>
                          setSaleForm({ ...saleForm, payment_method: e.target.value })
                        }
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 uppercase tracking-widest"
                      >
                        <option value="cash">Efectivo</option>
                        <option value="transfer">Transferencia</option>
                        <option value="card">Tarjeta</option>
                        <option value="check">Cheque</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">
                        Referencia (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: # Transacción"
                        value={saleForm.reference_number}
                        onChange={(e) =>
                          setSaleForm({ ...saleForm, reference_number: e.target.value })
                        }
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">
                      Notas / Comentarios
                    </label>
                    <textarea
                      placeholder="Comentarios sobre la transacción..."
                      value={saleForm.notes}
                      onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                      rows={2}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Botones de Envío */}
              <div className="flex gap-4 pt-6 border-t border-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSaleModal(false)}
                  className="flex-1 py-4 bg-slate-100 rounded-2xl text-xs font-black uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !saleForm.student_id || cart.length === 0}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
                >
                  {loading
                    ? 'Procesando...'
                    : saleForm.immediate_pay
                      ? 'Facturar y Cobrar'
                      : 'Facturar Pendiente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {receiptStudent && receiptInvoices && (
        <PaymentModal
          student={receiptStudent}
          courseName={
            receiptStudent.courses?.name ||
            receiptStudent.course_name ||
            state.courses?.find((c) => c.id === receiptStudent.course_id)?.name ||
            'Grado'
          }
          invoice={receiptInvoices}
          onClose={() => {
            setReceiptStudent(null);
            setReceiptInvoices(null);
          }}
          onSuccess={() => {
            setReceiptStudent(null);
            setReceiptInvoices(null);
          }}
        />
      )}
    </div>
  );
};
