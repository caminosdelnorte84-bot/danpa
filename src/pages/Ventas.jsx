import { useEffect, useState, useRef } from 'react'
import { supabase } from '../services/supabase'
import { useCart } from '../context/CartContext'
import { useProfile } from '../context/ProfileContext'

const FILTROS = ['todos', 'Pendiente', 'En camino', 'Entregado', 'Cancelado', 'Rechazado']
const FILTROS_PAGO = ['todos', 'pagado', 'parcial', 'no_pagado']

const ESTADO_BADGE = {
  Pendiente: 'bg-[var(--warning-bg)] text-[var(--warning-text)]',
  'En camino': 'bg-[var(--brand-light)] text-[var(--brand)]',
  Entregado: 'bg-[var(--success-bg)] text-[var(--success-text)]',
  Cancelado: 'bg-[var(--surface-2)] text-[var(--ink-muted)]',
  Rechazado: 'bg-[var(--danger-bg)] text-[var(--danger)]',
}

const PAGO_BADGE = {
  pagado: { bg: 'var(--success-bg)', text: 'var(--success-text)', label: 'Pagado' },
  parcial: { bg: 'var(--warning-bg)', text: 'var(--warning-text)', label: 'Parcial' },
  no_pagado: { bg: 'var(--danger-bg)', text: 'var(--danger)', label: 'Sin pagar' },
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden animate-pulse">
          <div className="h-32 bg-[var(--surface-2)]" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-[var(--surface-2)] rounded w-3/4" />
            <div className="h-3 bg-[var(--surface-2)] rounded w-1/2" />
            <div className="h-6 bg-[var(--surface-2)] rounded w-20 mt-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Ventas() {
  const { profile } = useProfile()
  const { items, addItem, removeItem, updateQuantity, total, clearCart } = useCart()
  const [tab, setTab] = useState('nueva')
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState([])
  const [cargandoClientes, setCargandoClientes] = useState(true)
  const [clienteId, setClienteId] = useState('')
  const [notas, setNotas] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [showClientes, setShowClientes] = useState(false)
  const [pedidos, setPedidos] = useState([])
  const [pedidosLoading, setPedidosLoading] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [filtroPago, setFiltroPago] = useState('todos')
  const [busquedaPedido, setBusquedaPedido] = useState('')
  const timerExito = useRef(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: prods } = await supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre')
      if (!cancelled) {
        setProductos(prods || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('clientes')
          .select('id, nombre, telefono')
          .eq('corredor_id', user.id)
          .eq('activo', true)
          .order('nombre')
        if (!cancelled) {
          setClientes(data || [])
          setCargandoClientes(false)
        }
      } catch {
        if (!cancelled) setCargandoClientes(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => { if (timerExito.current) clearTimeout(timerExito.current) }
  }, [])

  const cargarPedidos = async () => {
    setPedidosLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let query = supabase
      .from('pedidos')
      .select('*, clientes(nombre, telefono)')
      .order('created_at', { ascending: false })
    if (profile?.perfil !== 'admin' && profile?.perfil !== 'dios') {
      query = query.eq('corredor_id', user.id)
    }
    const { data } = await query
    setPedidos(data || [])
    setPedidosLoading(false)
  }

  useEffect(() => {
    if (tab === 'pedidos') {
      cargarPedidos()
    }
  }, [tab, profile?.perfil])

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
    c.telefono?.toLowerCase().includes(busquedaCliente.toLowerCase())
  )

  const pedidosFiltrados = pedidos.filter(p => {
    const matchEstado = filtro === 'todos' || p.estado === filtro
    const matchPago = filtroPago === 'todos' || p.estado_pago === filtroPago
    if (!matchEstado || !matchPago) return false
    if (busquedaPedido) {
      const q = busquedaPedido.toLowerCase()
      return p.clientes?.nombre?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q)
    }
    return true
  })

  const handleConfirmar = async () => {
    if (!clienteId || items.length === 0) return
    setConfirmando(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          corredor_id: user.id,
          cliente_id: clienteId,
          total,
          notas,
          estado: 'Pendiente',
        })
        .select()
        .single()

      if (pedidoError) throw new Error('Error al crear el pedido: ' + pedidoError.message)

      const itemsToInsert = items.map(item => ({
        pedido_id: pedido.id,
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
      }))

      const { error: itemsError } = await supabase.from('pedido_items').insert(itemsToInsert)
      if (itemsError) {
        await supabase.from('pedidos').delete().eq('id', pedido.id)
        throw new Error('Error al guardar los items: ' + itemsError.message)
      }

      clearCart()
      setClienteId('')
      setNotas('')
      setConfirmando(false)
      setExito(true)
      timerExito.current = setTimeout(() => { setExito(false); setTab('pedidos'); cargarPedidos() }, 1500)
    } catch (err) {
      setError(err.message)
      setConfirmando(false)
    }
  }

  const cambiarEstado = async (pedidoId, nuevoEstado) => {
    const confirmaciones = {
      Cancelado: '¿Cancelar este pedido? No se podrá revertir.',
      Rechazado: '¿Rechazar este pedido?',
    }
    if (confirmaciones[nuevoEstado] && !confirm(confirmaciones[nuevoEstado])) return
    try {
      const { error } = await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedidoId)
      if (error) throw error
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: nuevoEstado } : p))
    } catch (err) {
      alert('Error al cambiar estado: ' + err.message)
    }
  }

  const clienteSel = clientes.find(c => c.id === clienteId)

  const fmt = (n) => '$' + (n || 0).toFixed(2)
  const formatFecha = (f) => new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const horasDesde = (fecha) => {
    const horas = (new Date() - new Date(fecha)) / 3600000
    if (horas < 1) return 'Recién'
    if (horas < 24) return `${Math.floor(horas)}h`
    return `${Math.floor(horas / 24)}d`
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Tabs ─── */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
        <button onClick={() => setTab('nueva')}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={tab === 'nueva' ? { background: 'var(--surface)', color: 'var(--ink-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--ink-muted)' }}>
          Nueva Venta
        </button>
        <button onClick={() => setTab('pedidos')}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          style={tab === 'pedidos' ? { background: 'var(--surface)', color: 'var(--ink-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--ink-muted)' }}>
          Pedidos
        </button>
      </div>

      {tab === 'nueva' ? (
        /* ══════ NUEVA VENTA (POS) ══════ */
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-14rem)]">
          {/* ─── Productos ─── */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="relative mb-4 shrink-0">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-12 pr-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] text-base" />
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {loading ? <Skeleton /> : filtrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-[var(--ink-secondary)] text-lg font-medium">No se encontraron productos</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtrados.map(p => {
                    const enCarrito = items.find(i => i.id === p.id)
                    return (
                      <div key={p.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col transition-shadow hover:shadow-[0_2px_12px_rgba(26,23,20,0.06)]">
                        <div className="h-28 bg-[var(--surface-2)] flex items-center justify-center overflow-hidden">
                          {p.imagen_url ? (
                            <img src={p.imagen_url} alt={p.nombre} className="h-full w-full object-cover" />
                          ) : (
                            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="var(--ink-muted)" strokeWidth="1.2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                          )}
                        </div>
                        <div className="p-3 flex flex-col flex-1">
                          <h3 className="font-semibold text-sm text-[var(--ink-primary)] leading-snug">{p.nombre}</h3>
                          <div className="flex items-center justify-between mt-auto pt-3">
                            <span className="text-lg font-bold text-[var(--brand)] tabular-nums">{fmt(p.precio)}</span>
                            <span className="text-[10px] font-medium text-[var(--ink-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full">
                              Stock: {p.stock}
                            </span>
                          </div>
                          {enCarrito ? (
                            <div className="flex items-center justify-between mt-2 bg-[var(--surface-2)] rounded-lg">
                              <button onClick={() => updateQuantity(p.id, enCarrito.cantidad - 1)}
                                className="w-8 h-8 flex items-center justify-center text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] rounded-l-lg">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                              </button>
                              <span className="text-sm font-semibold text-[var(--ink-primary)] tabular-nums">{enCarrito.cantidad}</span>
                              <button onClick={() => updateQuantity(p.id, enCarrito.cantidad + 1)}
                                disabled={p.stock != null && enCarrito.cantidad >= p.stock}
                                className="w-8 h-8 flex items-center justify-center text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] rounded-r-lg disabled:opacity-30">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => addItem(p)}
                              disabled={p.stock <= 0}
                              className="w-full mt-2 py-2 rounded-lg text-sm font-medium transition bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-muted)] disabled:cursor-not-allowed active:scale-[0.97]">
                              {p.stock <= 0 ? 'Sin stock' : 'Agregar'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Carrito lateral ─── */}
          <div className="w-full lg:w-96 shrink-0 flex flex-col">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl flex flex-col h-full overflow-hidden relative">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--ink-primary)]">
                  Carrito {items.length > 0 && <span className="text-[var(--ink-muted)] font-normal">({items.length})</span>}
                </h2>
                {items.length > 0 && (
                  <button onClick={clearCart} className="text-xs font-medium text-[var(--danger)] hover:opacity-80 transition">
                    Vaciar
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <svg className="w-10 h-10 text-[var(--ink-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                    </svg>
                    <p className="text-sm text-[var(--ink-muted)]">Seleccioná productos de la lista</p>
                  </div>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--ink-primary)] truncate">{item.nombre}</p>
                        <p className="text-xs text-[var(--brand)] font-semibold tabular-nums">{fmt(item.precio)}</p>
                      </div>
                      <div className="flex items-center bg-[var(--surface-2)] rounded-lg shrink-0">
                        <button onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                          className="w-7 h-7 flex items-center justify-center text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] rounded-l-lg">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                        <span className="w-7 text-center text-xs font-semibold text-[var(--ink-primary)] tabular-nums">{item.cantidad}</span>
                        <button onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                          disabled={item.stock != null && item.cantidad >= item.stock}
                          className="w-7 h-7 flex items-center justify-center text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] rounded-r-lg disabled:opacity-30">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                      </div>
                      <p className="font-semibold text-[var(--ink-primary)] text-xs tabular-nums w-16 text-right shrink-0">
                        {fmt(item.precio * item.cantidad)}
                      </p>
                      <button onClick={() => removeItem(item.id)}
                        className="text-[var(--ink-muted)] hover:text-[var(--danger)] shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <div className="border-t border-[var(--border)] px-5 py-4 space-y-3">
                  <div className="relative">
                    <label className="block text-xs font-medium text-[var(--ink-secondary)] mb-1">Cliente</label>
                    {cargandoClientes ? (
                      <div className="text-xs text-[var(--ink-muted)] py-2">Cargando clientes...</div>
                    ) : clienteSel ? (
                      <div className="flex items-center justify-between bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-[var(--ink-primary)]">{clienteSel.nombre}</p>
                          {clienteSel.telefono && <p className="text-[10px] text-[var(--ink-muted)]">{clienteSel.telefono}</p>}
                        </div>
                        <button onClick={() => { setClienteId(''); setShowClientes(false) }}
                          className="text-[var(--ink-muted)] hover:text-[var(--danger)]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input type="text" value={busquedaCliente} onChange={e => { setBusquedaCliente(e.target.value); setShowClientes(true) }}
                          onFocus={() => setShowClientes(true)}
                          placeholder="Buscar cliente..."
                          className="w-full px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]" />
                        {showClientes && clientesFiltrados.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {clientesFiltrados.map(c => (
                              <button key={c.id} onClick={() => { setClienteId(c.id); setShowClientes(false); setBusquedaCliente('') }}
                                className="w-full text-left px-3 py-2.5 text-sm text-[var(--ink-primary)] hover:bg-[var(--hover-subtle)] transition flex items-center gap-2">
                                <span className="font-medium">{c.nombre}</span>
                                {c.telefono && <span className="text-[10px] text-[var(--ink-muted)]">{c.telefono}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--ink-secondary)] mb-1">Notas <span className="text-[var(--ink-muted)]">(opcional)</span></label>
                    <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                      className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] resize-none outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
                      placeholder="Instrucciones especiales..." />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-[var(--ink-secondary)]">Total</span>
                    <span className="text-xl font-bold text-[var(--brand)] tabular-nums">{fmt(total)}</span>
                  </div>

                  {error && (
                    <div className="bg-[var(--danger-bg)] border border-[var(--danger)] rounded-lg px-3 py-2">
                      <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{error}</p>
                    </div>
                  )}

                  <button onClick={handleConfirmar}
                    disabled={confirmando || !clienteId}
                    className="w-full py-3 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white font-bold text-sm rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {confirmando ? 'Confirmando...' : 'Confirmar Pedido'}
                  </button>
                </div>
              )}

              {exito && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]/95 z-10">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--brand)] mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <p className="font-semibold text-[var(--brand)] text-lg">¡Pedido confirmado!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ══════ PEDIDOS ══════ */
        <div>
          {pedidosLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
                  <div className="flex justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-28 bg-[var(--surface-2)] rounded" />
                      <div className="h-4 w-40 bg-[var(--surface-2)] rounded" />
                    </div>
                    <div className="h-5 w-20 bg-[var(--surface-2)] rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-3 flex-wrap">
                <div className="flex-1 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ink-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input type="text" value={busquedaPedido} onChange={e => setBusquedaPedido(e.target.value)}
                    placeholder="Buscar por cliente o ID..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border outline-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
                </div>
              </div>

              <div className="flex gap-2 mb-2 flex-wrap">
                {FILTROS.map(f => (
                  <button key={f} onClick={() => setFiltro(f)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                    style={filtro === f ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--ink-secondary)' }}>
                    {f === 'todos' ? 'Todos' : f}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-4 flex-wrap">
                {FILTROS_PAGO.map(f => (
                  <button key={f} onClick={() => setFiltroPago(f)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition"
                    style={filtroPago === f ? { background: 'var(--ink-primary)', color: 'var(--bg)' } : { background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                    {f === 'todos' ? 'Todos los pagos' : PAGO_BADGE[f]?.label || f}
                  </button>
                ))}
              </div>

              {pedidosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-lg" style={{ color: 'var(--ink-muted)' }}>No hay pedidos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pedidosFiltrados.map(pedido => {
                    const horas = (new Date() - new Date(pedido.created_at)) / 3600000
                    const esUrgente = pedido.estado === 'Pendiente' && horas > 24
                    const pagoInfo = PAGO_BADGE[pedido.estado_pago] || PAGO_BADGE.no_pagado
                    return (
                      <div key={pedido.id}
                        className="bg-[var(--surface)] border rounded-xl p-4 flex items-center gap-4 transition-colors hover:bg-[var(--hover-subtle)]"
                        style={{ borderColor: esUrgente ? 'var(--danger)' : 'var(--border)' }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs tabular-nums font-medium" style={{ color: 'var(--ink-muted)' }}>{formatFecha(pedido.created_at)}</p>
                            {esUrgente && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{horasDesde(pedido.created_at)}</span>}
                          </div>
                          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--ink-primary)' }}>{pedido.clientes?.nombre || 'Sin nombre'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_BADGE[pedido.estado] || ''}`}>{pedido.estado}</span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: pagoInfo.text, background: pagoInfo.bg, padding: '2px 8px', borderRadius: '999px' }}>{pagoInfo.label}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold tabular-nums" style={{ color: 'var(--brand)' }}>{fmt(pedido.total)}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {pedido.estado === 'Pendiente' && (
                            <>
                              <button onClick={() => cambiarEstado(pedido.id, 'En camino')}
                                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition" style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}>
                                En camino
                              </button>
                              <button onClick={() => cambiarEstado(pedido.id, 'Cancelado')}
                                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                                Cancelar
                              </button>
                            </>
                          )}
                          {pedido.estado === 'En camino' && (
                            <>
                              <button onClick={() => cambiarEstado(pedido.id, 'Entregado')}
                                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition text-white" style={{ background: 'var(--brand)' }}>
                                Entregar
                              </button>
                              <button onClick={() => cambiarEstado(pedido.id, 'Rechazado')}
                                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                                Rechazar
                              </button>
                            </>
                          )}
                          {pedido.estado === 'Entregado' && (
                            <span className="text-[11px] px-2 py-1 rounded-lg font-medium" style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}>
                              Finalizado
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}