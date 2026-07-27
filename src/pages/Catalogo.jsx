import { useEffect, useState, useRef } from 'react'
import { supabase } from '../services/supabase'
import { useCart } from '../context/CartContext'
import { useProfile } from '../context/ProfileContext'

function SkeletonCard() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden animate-pulse">
      <div className="h-44 bg-[var(--surface-2)]" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-[var(--surface-2)] rounded w-3/4" />
        <div className="h-3.5 bg-[var(--surface-2)] rounded w-full" />
        <div className="flex items-center justify-between mt-4">
          <div className="h-7 bg-[var(--surface-2)] rounded w-20" />
          <div className="h-5 bg-[var(--surface-2)] rounded w-16" />
        </div>
        <div className="h-11 bg-[var(--surface-2)] rounded-lg mt-4 w-full" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-5">
        <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="var(--ink-muted)" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
      <p className="text-[var(--ink-secondary)] text-lg font-medium">No se encontraron productos</p>
      <p className="text-[var(--ink-muted)] text-sm mt-1">Intenta con otro término de búsqueda</p>
    </div>
  )
}

export default function Catalogo() {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [agregado, setAgregado] = useState(null)
  const [animando, setAnimando] = useState(null)
  const { addItem } = useCart()
  const { hasPermission } = useProfile()

  const timerAnimando = useRef(null)
  const timerAgregado = useRef(null)

  useEffect(() => {
    let cancelled = false
    const fetchProductos = async () => {
      const { data } = await supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre')
      if (!cancelled) {
        setProductos(data || [])
        setLoading(false)
      }
    }
    fetchProductos()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => {
      if (timerAnimando.current) clearTimeout(timerAnimando.current)
      if (timerAgregado.current) clearTimeout(timerAgregado.current)
    }
  }, [])

  const handleAdd = (producto) => {
    setAnimando(producto.id)
    timerAnimando.current = setTimeout(() => setAnimando(null), 150)

    addItem(producto)
    setAgregado(producto.id)
    timerAgregado.current = setTimeout(() => setAgregado(null), 1500)
  }

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      {/* Search */}
      <div className="mb-8">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none"
            width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full pl-12 pr-4 py-3.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] transition-all text-base"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtrados.map(producto => (
            <div
              key={producto.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col transition-shadow duration-150 hover:shadow-[0_2px_12px_rgba(26,23,20,0.06)]"
            >
              {/* Image area */}
              <div className="h-44 bg-[var(--surface-2)] flex items-center justify-center overflow-hidden">
                {producto.imagen_url ? (
                  <img
                    src={producto.imagen_url}
                    alt={producto.nombre}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="var(--ink-muted)" strokeWidth="1.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-semibold text-base text-[var(--ink-primary)] leading-snug">{producto.nombre}</h3>
                {producto.descripcion && (
                  <p className="text-[var(--ink-secondary)] text-sm mt-1 line-clamp-2">{producto.descripcion}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-4">
                  <span
                    className="text-2xl font-bold text-[var(--brand)]"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    ${producto.precio.toFixed(2)}
                  </span>
                  <span className="text-xs font-medium text-[var(--ink-muted)] bg-[var(--surface-2)] px-2.5 py-1 rounded-full">
                    Stock: {producto.stock}
                  </span>
                </div>

                {/* Signature element */}
                {hasPermission('carrito') && (
                <button
                  onClick={() => handleAdd(producto)}
                  disabled={agregado === producto.id || producto.stock <= 0}
                  className={`
                    w-full mt-4 py-3 rounded-lg font-medium text-sm
                    transition-all duration-150 ease-out
                    active:scale-[0.97]
                    ${producto.stock <= 0
                      ? 'bg-[var(--surface-2)] text-[var(--ink-muted)] cursor-not-allowed'
                      : agregado === producto.id
                      ? 'bg-[var(--brand-light)] text-[var(--brand)] cursor-default'
                      : 'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] cursor-pointer'
                    }
                    ${animando === producto.id ? 'scale-95' : 'scale-100'}
                  `}
                  style={{ fontWeight: 500 }}
                >
                  {producto.stock <= 0 ? 'Sin stock' : agregado === producto.id ? '✓ Agregado' : 'Agregar al carrito'}
                </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
