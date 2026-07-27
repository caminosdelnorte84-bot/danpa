import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../services/supabase'
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

const TIPOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta_credito', label: 'Tarjeta Crédito' },
  { value: 'tarjeta_debito', label: 'Tarjeta Débito' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'otro', label: 'Otro' },
]

function SkeletonCard() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-3 w-28 bg-[var(--surface-2)] rounded" />
          <div className="h-4 w-40 bg-[var(--surface-2)] rounded" />
        </div>
        <div className="space-y-2 flex flex-col items-end">
          <div className="h-5 w-20 bg-[var(--surface-2)] rounded-full" />
          <div className="h-5 w-16 bg-[var(--surface-2)] rounded" />
        </div>
      </div>
    </div>
  )
}

function fechaLocal() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export default function Pedidos() {
  const { profile } = useProfile()
  const [pedidos, setPedidos] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [filtroPago, setFiltroPago] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [detalles, setDetalles] = useState({})
  const [cobrando, setCobrando] = useState(null)
  const [formPago, setFormPago] = useState({
    monto_pagado: '', tipo_pago: 'efectivo', referencia_pago: '', fecha_pago: fechaLocal()
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      let query = supabase
        .from('pedidos')
        .select('*, clientes(nombre, telefono)')
        .order('created_at', { ascending: false })
      if (profile?.perfil !== 'admin') {
        query = query.eq('corredor_id', user.id)
      }
      const { data } = await query
      if (!cancelled) {
        setPedidos(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profile?.perfil])

  const fetchDetalle = async (pedidoId) => {
    if (detalles[pedidoId]) return
    const { data } = await supabase
      .from('pedido_items')
      .select('*, productos(nombre)')
      .eq('pedido_id', pedidoId)
    setDetalles(prev => ({ ...prev, [pedidoId]: data || [] }))
  }

  const toggleExpand = async (pedidoId) => {
    if (expandido === pedidoId) { setExpandido(null) }
    else { setExpandido(pedidoId); await fetchDetalle(pedidoId) }
  }

  const cambiarEstado = async (pedidoId, nuevoEstado) => {
    const confirmaciones = {
      'Cancelado': '¿Cancelar este pedido? No se podrá revertir.',
      'Rechazado': '¿Rechazar este pedido?',
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

  const confirmarEntrega = async () => {
    const pedido = pedidos.find(p => p.id === cobrando)
    if (!pedido) return

    const monto = parseFloat(formPago.monto_pagado) || 0
    if (monto < 0) { alert('El monto no puede ser negativo'); return }
    if (monto > pedido.total * 1.5) { if (!confirm(`El monto ($${monto.toFixed(2)}) es mayor al total ($${pedido.total.toFixed(2)}). ¿Continuar?`)) return }

    const total = pedido.total
    let estado_pago = 'no_pagado'
    if (monto >= total) estado_pago = 'pagado'
    else if (monto > 0) estado_pago = 'parcial'

    try {
      const { error } = await supabase.from('pedidos').update({
        estado: 'Entregado',
        estado_pago,
        monto_pagado: monto,
        tipo_pago: formPago.tipo_pago,
        fecha_pago: formPago.fecha_pago,
        referencia_pago: formPago.referencia_pago,
      }).eq('id', cobrando)
      if (error) throw error

      setPedidos(prev => prev.map(p => p.id === cobrando ? {
        ...p, estado: 'Entregado', estado_pago, monto_pagado: monto,
        tipo_pago: formPago.tipo_pago, fecha_pago: formPago.fecha_pago, referencia_pago: formPago.referencia_pago,
      } : p))

      const { data: items } = await supabase
        .from('pedido_items')
        .select('*, productos(nombre)')
        .eq('pedido_id', cobrando)

      enviarWhatsApp({ ...pedido, estado: 'Entregado' }, items || [], monto, formPago.tipo_pago)

      setCobrando(null)
      setFormPago({ monto_pagado: '', tipo_pago: 'efectivo', referencia_pago: '', fecha_pago: fechaLocal() })
    } catch (err) {
      alert('Error al confirmar entrega: ' + err.message)
    }
  }

  const registrarPago = async (pedidoId) => {
    const pedido = pedidos.find(p => p.id === pedidoId)
    if (!pedido) return
    const monto = parseFloat(formPago.monto_pagado) || 0
    if (monto < 0) { alert('El monto no puede ser negativo'); return }
    const nuevoMonto = (pedido.monto_pagado || 0) + monto
    if (nuevoMonto > pedido.total * 1.5) { if (!confirm(`El total pagado ($${nuevoMonto.toFixed(2)}) excede el pedido ($${pedido.total.toFixed(2)}). ¿Continuar?`)) return }

    let estado_pago = 'no_pagado'
    if (nuevoMonto >= pedido.total) estado_pago = 'pagado'
    else if (nuevoMonto > 0) estado_pago = 'parcial'

    try {
      const { error } = await supabase.from('pedidos').update({
        estado_pago, monto_pagado: nuevoMonto, tipo_pago: formPago.tipo_pago,
        referencia_pago: formPago.referencia_pago,
      }).eq('id', pedidoId)
      if (error) throw error

      setPedidos(prev => prev.map(p => p.id === pedidoId ? {
        ...p, estado_pago, monto_pagado: nuevoMonto, tipo_pago: formPago.tipo_pago, referencia_pago: formPago.referencia_pago,
      } : p))

      setCobrando(null)
      setFormPago({ monto_pagado: '', tipo_pago: 'efectivo', referencia_pago: '', fecha_pago: fechaLocal() })
    } catch (err) {
      alert('Error al registrar pago: ' + err.message)
    }
  }

  const metricas = useMemo(() => {
    const total = pedidos.length
    const pendientes = pedidos.filter(p => p.estado === 'Pendiente')
    const enCamino = pedidos.filter(p => p.estado === 'En camino')
    const entregados = pedidos.filter(p => p.estado === 'Entregado')
    const cancelados = pedidos.filter(p => p.estado === 'Cancelado' || p.estado === 'Rechazado')

    const montoTotal = pedidos.reduce((s, p) => s + (p.total || 0), 0)
    const cobrado = pedidos.reduce((s, p) => s + (p.monto_pagado || 0), 0)
    const porCobrar = montoTotal - cobrado

    const ahora = new Date()
    const urgentes = pendientes.filter(p => {
      const horas = (ahora - new Date(p.created_at)) / 3600000
      return horas > 24
    })

    return { total, pendientes: pendientes.length, enCamino: enCamino.length, entregados: entregados.length, cancelados: cancelados.length, montoTotal, cobrado, porCobrar, urgentes: urgentes.length }
  }, [pedidos])

  const filtrados = useMemo(() => {
    return pedidos.filter(p => {
      const matchEstado = filtro === 'todos' || p.estado === filtro
      const matchPago = filtroPago === 'todos' || p.estado_pago === filtroPago
      if (!matchEstado || !matchPago) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const matchCliente = p.clientes?.nombre?.toLowerCase().includes(q)
        const matchId = p.id?.toLowerCase().includes(q)
        return matchCliente || matchId
      }
      return true
    })
  }, [pedidos, filtro, filtroPago, busqueda])

  const formatFecha = (f) => new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const fmt = (n) => '$' + (n || 0).toFixed(2)

  const horasDesde = (fecha) => {
    const horas = (new Date() - new Date(fecha)) / 3600000
    if (horas < 1) return 'Recién'
    if (horas < 24) return `${Math.floor(horas)}h`
    return `${Math.floor(horas / 24)}d`
  }

  const exportarCSV = () => {
    const esc = (v) => {
      const s = String(v ?? '')
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    }
    const headers = ['Fecha', 'Cliente', 'Estado', 'Pago', 'Tipo', 'Total', 'Pagado', 'Pendiente']
    const rows = filtrados.map(p => [
      formatFecha(p.created_at),
      p.clientes?.nombre || '',
      p.estado,
      PAGO_BADGE[p.estado_pago]?.label || '',
      p.tipo_pago || '',
      p.total,
      p.monto_pagado || 0,
      p.total - (p.monto_pagado || 0),
    ])
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const enviarWhatsApp = (pedido, items, montoPagado, tipoPago) => {
    const cliente = pedido.clientes?.nombre || 'Cliente'
    const telefono = pedido.clientes?.telefono
    if (!telefono) { alert('El cliente no tiene teléfono registrado'); return }
    const tel = telefono.replace(/[^0-9+]/g, '')
    const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    const estadoPago = montoPagado >= pedido.total ? 'PAGADO' : montoPagado > 0 ? `PARCIAL ($${montoPagado.toFixed(2)} de $${pedido.total.toFixed(2)})` : 'SIN PAGAR'

    let mensaje = `*PEDIDO CONFIRMADO - danpa*\n\n`
    mensaje += `Cliente: ${cliente}\n`
    mensaje += `Fecha: ${fecha}\n`
    mensaje += `Estado: ENTREGADO\n\n`
    mensaje += `*Detalle:*\n`

    items.forEach(item => {
      mensaje += `- ${item.productos?.nombre || 'Producto'} x${item.cantidad} = $${(item.precio_unitario * item.cantidad).toFixed(2)}\n`
    })

    mensaje += `\n*Total: $${pedido.total.toFixed(2)}*\n`
    mensaje += `*Pago: ${estadoPago}*\n`
    mensaje += `Tipo: ${tipoPago?.replace('_', ' ') || 'No especificado'}\n`

    if (pedido.referencia_pago) {
      mensaje += `Ref: ${pedido.referencia_pago}\n`
    }

    if (pedido.notas) {
      mensaje += `\nNotas: ${pedido.notas}\n`
    }

    const url = `https://wa.me/${tel.startsWith('+') ? tel.substring(1) : tel}?text=${encodeURIComponent(mensaje)}`
    window.open(url, '_blank')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--ink-primary)' }}>Mis Pedidos</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-secondary)' }}>Gestión de pedidos y control de cobros</p>
        </div>
        <button onClick={exportarCSV}
          className="px-3 py-2 text-sm font-medium rounded-lg transition flex items-center gap-1.5"
          style={{ background: 'var(--surface-2)', color: 'var(--ink-secondary)' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          CSV
        </button>
      </div>

      {!loading && metricas.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>Pendientes</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--warning-text)' }}>{metricas.pendientes}</p>
              {metricas.urgentes > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                  {metricas.urgentes} {'>24h'}
                </span>
              )}
            </div>
          </div>
          <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>En camino</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--brand)' }}>{metricas.enCamino}</p>
          </div>
          <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>Entregados</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--success-text)' }}>{metricas.entregados}</p>
          </div>
          <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>Por cobrar</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: metricas.porCobrar > 0 ? 'var(--danger)' : 'var(--ink-muted)' }}>{fmt(metricas.porCobrar)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ink-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
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
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTROS_PAGO.map(f => (
          <button key={f} onClick={() => setFiltroPago(f)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition"
            style={filtroPago === f ? { background: 'var(--ink-primary)', color: 'var(--bg)' } : { background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
            {f === 'todos' ? 'Todos los pagos' : PAGO_BADGE[f]?.label || f}
          </button>
        ))}
      </div>

      {loading && <div className="space-y-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>}

      {!loading && filtrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg" style={{ color: 'var(--ink-muted)' }}>No hay pedidos</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
            {busqueda ? 'Intenta con otra búsqueda' : 'Crea tu primer pedido desde el catálogo'}
          </p>
        </div>
      )}

      {!loading && filtrados.length > 0 && (
        <div className="space-y-3">
          {filtrados.map(pedido => {
            const saldo = pedido.total - (pedido.monto_pagado || 0)
            const pctPagado = pedido.total > 0 ? ((pedido.monto_pagado || 0) / pedido.total * 100) : 0
            const pagoInfo = PAGO_BADGE[pedido.estado_pago] || PAGO_BADGE.no_pagado
            const horas = (new Date() - new Date(pedido.created_at)) / 3600000
            const esUrgente = pedido.estado === 'Pendiente' && horas > 24

            return (
              <div key={pedido.id} className="bg-[var(--surface)] border rounded-xl overflow-hidden"
                style={{ borderColor: esUrgente ? 'var(--danger)' : 'var(--border)' }}>
                <button onClick={() => toggleExpand(pedido.id)}
                  className="w-full text-left p-5 transition-colors hover:bg-[var(--hover-subtle)] cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs tabular-nums font-medium" style={{ color: 'var(--ink-muted)' }}>{formatFecha(pedido.created_at)}</p>
                        {esUrgente && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                            {horasDesde(pedido.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-[15px] font-semibold mt-1.5" style={{ color: 'var(--ink-primary)' }}>{pedido.clientes?.nombre || 'Sin nombre'}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: pagoInfo.bg, color: pagoInfo.text }}>
                          {pagoInfo.label}
                        </span>
                        {pedido.tipo_pago && (
                          <span className="text-[11px] capitalize" style={{ color: 'var(--ink-muted)' }}>{pedido.tipo_pago.replace('_', ' ')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ESTADO_BADGE[pedido.estado] || ''}`}>
                        {pedido.estado}
                      </span>
                      <p className="text-base font-bold tabular-nums" style={{ color: 'var(--brand)' }}>{fmt(pedido.total)}</p>
                      {pedido.estado === 'Entregado' && pedido.estado_pago !== 'pagado' && (
                        <p className="text-xs font-semibold tabular-nums" style={{ color: 'var(--danger)' }}>Pendiente: {fmt(saldo)}</p>
                      )}
                      {pedido.estado === 'Entregado' && (
                        <div className="w-20 h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pctPagado}%`, background: pctPagado >= 100 ? 'var(--success-text)' : 'var(--warning-text)' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {expandido === pedido.id && (
                  <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--ink-muted)' }}>Detalle del pedido</p>
                    {(detalles[pedido.id] || []).length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Cargando...</p>
                    ) : (
                      <div className="space-y-0">
                        {(detalles[pedido.id] || []).map(item => (
                          <div key={item.id} className="flex justify-between items-center py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                            <span className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{item.productos?.nombre} <span style={{ color: 'var(--ink-muted)' }}>x{item.cantidad}</span></span>
                            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ink-primary)' }}>{fmt(item.precio_unitario * item.cantidad)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {pedido.estado === 'Entregado' && (
                      <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-primary)' }}>Control de Cobro</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span style={{ color: 'var(--ink-muted)' }}>Pagado:</span> <span className="font-semibold" style={{ color: 'var(--success-text)' }}>{fmt(pedido.monto_pagado)}</span></div>
                          <div><span style={{ color: 'var(--ink-muted)' }}>Pendiente:</span> <span className="font-semibold" style={{ color: saldo > 0 ? 'var(--danger)' : 'var(--success-text)' }}>{fmt(saldo)}</span></div>
                          <div><span style={{ color: 'var(--ink-muted)' }}>Tipo:</span> <span className="capitalize font-medium">{pedido.tipo_pago?.replace('_', ' ') || '—'}</span></div>
                          <div><span style={{ color: 'var(--ink-muted)' }}>Fecha pago:</span> <span className="font-medium">{pedido.fecha_pago || '—'}</span></div>
                          {pedido.referencia_pago && <div className="col-span-2"><span style={{ color: 'var(--ink-muted)' }}>Ref:</span> <span className="font-medium">{pedido.referencia_pago}</span></div>}
                        </div>
                      </div>
                    )}

                    {pedido.notas && (
                      <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--ink-muted)' }}>Notas</p>
                        <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{pedido.notas}</p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-4 flex-wrap">
                      {pedido.estado === 'Pendiente' && (
                        <>
                          <button onClick={() => cambiarEstado(pedido.id, 'En camino')}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition" style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}>
                            Marcar En camino
                          </button>
                          <button onClick={() => cambiarEstado(pedido.id, 'Cancelado')}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                            Cancelar
                          </button>
                        </>
                      )}
                      {pedido.estado === 'En camino' && (
                        <>
                          <button onClick={() => cambiarEstado(pedido.id, 'Entregado')}
                            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition" style={{ background: 'var(--brand)' }}>
                            Entregar y cobrar
                          </button>
                          <button onClick={() => cambiarEstado(pedido.id, 'Rechazado')}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                            Rechazar
                          </button>
                        </>
                      )}
                      {pedido.estado === 'Entregado' && pedido.estado_pago !== 'pagado' && cobrando !== pedido.id && (
                        <button onClick={() => { setCobrando(pedido.id); setFormPago({ monto_pagado: saldo.toFixed(2), tipo_pago: pedido.tipo_pago || 'efectivo', referencia_pago: '', fecha_pago: fechaLocal() }) }}
                          className="px-4 py-2 text-white text-sm font-medium rounded-lg transition" style={{ background: 'var(--success-text)' }}>
                          Registrar pago
                        </button>
                      )}
                    </div>

                    {cobrando === pedido.id && (
                      <div className="mt-4 p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-primary)' }}>
                          {pedido.estado === 'En camino' ? 'Entregar y registrar cobro' : 'Registrar pago adicional'}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--ink-muted)' }}>Monto a pagar</label>
                            <input type="number" step="0.01" min="0" value={formPago.monto_pagado}
                              onChange={e => setFormPago({ ...formPago, monto_pagado: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--ink-muted)' }}>Tipo de pago</label>
                            <select value={formPago.tipo_pago} onChange={e => setFormPago({ ...formPago, tipo_pago: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm border appearance-none cursor-pointer" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
                              {TIPOS_PAGO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--ink-muted)' }}>Fecha de pago</label>
                            <input type="date" value={formPago.fecha_pago}
                              onChange={e => setFormPago({ ...formPago, fecha_pago: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--ink-muted)' }}>Referencia (opcional)</label>
                            <input type="text" value={formPago.referencia_pago} placeholder="Nro. operación, comprobante..."
                              onChange={e => setFormPago({ ...formPago, referencia_pago: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={pedido.estado === 'En camino' ? confirmarEntrega : () => registrarPago(pedido.id)}
                            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition" style={{ background: 'var(--brand)' }}>
                            {pedido.estado === 'En camino' ? 'Confirmar entrega' : 'Guardar pago'}
                          </button>
                          <button onClick={() => setCobrando(null)}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition" style={{ background: 'var(--surface-2)', color: 'var(--ink-secondary)' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}