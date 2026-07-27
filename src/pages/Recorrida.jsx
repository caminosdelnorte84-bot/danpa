import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../services/supabase'
import { useProfile } from '../context/ProfileContext'

const markerVerde = new L.DivIcon({
  className: '',
  html: '<div style="width:28px;height:28px;background:#2d6a4f;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const markerGris = new L.DivIcon({
  className: '',
  html: '<div style="width:28px;height:28px;background:#a09890;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const markerRojo = new L.DivIcon({
  className: '',
  html: '<div style="width:28px;height:28px;background:#c1292e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const markerAzul = new L.DivIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function LocationMarker() {
  const map = useMap()
  const [pos, setPos] = useState(null)

  useEffect(() => {
    map.locate({ setView: false, maxZoom: 16 })
    const onFound = (e) => setPos(e.latlng)
    map.on('locationfound', onFound)
    return () => map.off('locationfound', onFound)
  }, [map])

  useEffect(() => {
    const id = setInterval(() => {
      map.locate({ setView: false, maxZoom: 16 })
    }, 10000)
    return () => clearInterval(id)
  }, [map])

  if (!pos) return null
  return <Marker position={pos} icon={markerAzul}><Popup>Tu ubicación</Popup></Marker>
}

function fechaLocal() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export default function Recorrida() {
  const { profile } = useProfile()
  const [clientes, setClientes] = useState([])
  const [visitas, setVisitas] = useState([])
  const [fecha, setFecha] = useState(fechaLocal())
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) { setLoading(false); return }

        let cliQuery = supabase
          .from('clientes')
          .select('*')
          .eq('activo', true)
          .order('nombre')

        let visQuery = supabase
          .from('visitas')
          .select('*, clientes(nombre)')
          .eq('fecha', fecha)

        if (profile?.perfil !== 'admin') {
          cliQuery = cliQuery.eq('corredor_id', user.id)
          visQuery = visQuery.eq('corredor_id', user.id)
        }

        const { data: cli } = await cliQuery
        const { data: vis } = await visQuery

        if (!cancelled) {
          setClientes(cli || [])
          setVisitas(vis || [])
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [fecha, profile?.perfil])

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let cliQuery = supabase
      .from('clientes')
      .select('*')
      .eq('activo', true)
      .order('nombre')

    let visQuery = supabase
      .from('visitas')
      .select('*, clientes(nombre)')
      .eq('fecha', fecha)

    if (profile?.perfil !== 'admin') {
      cliQuery = cliQuery.eq('corredor_id', user.id)
      visQuery = visQuery.eq('corredor_id', user.id)
    }

    const { data: cli } = await cliQuery
    const { data: vis } = await visQuery

    setClientes(cli || [])
    setVisitas(vis || [])
    setLoading(false)
  }

  const getEstado = (clienteId) => {
    const v = visitas.find(vis => vis.cliente_id === clienteId)
    return v ? v.estado : null
  }

  const getIcono = (estado) => {
    switch (estado) {
      case 'Completada': return markerVerde
      case 'Saltada': return markerRojo
      default: return markerGris
    }
  }

  const toggleVisita = async (clienteId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const estado = getEstado(clienteId)

      if (!estado) {
        await supabase.from('visitas').insert({
          corredor_id: user.id,
          cliente_id: clienteId,
          fecha,
          estado: 'Completada',
          latitud: null,
          longitud: null,
        })
      } else if (estado === 'Completada') {
        await supabase
          .from('visitas')
          .update({ estado: 'Saltada' })
          .eq('corredor_id', user.id)
          .eq('cliente_id', clienteId)
          .eq('fecha', fecha)
      } else {
        await supabase
          .from('visitas')
          .delete()
          .eq('corredor_id', user.id)
          .eq('cliente_id', clienteId)
          .eq('fecha', fecha)
      }

      await fetchData()
    } catch (err) {
      alert('Error al actualizar visita: ' + err.message)
    }
  }

  const clientesConUbicacion = clientes.filter(c => c.latitud && c.longitud)
  const stats = {
    total: clientes.length,
    completadas: visitas.filter(v => v.estado === 'Completada').length,
    saltadas: visitas.filter(v => v.estado === 'Saltada').length,
    pendientes: clientes.length - visitas.length,
  }

  const clientesFiltrados = clientes.filter(c => {
    const estado = getEstado(c.id)
    if (filtro === 'todos') return true
    if (filtro === 'pendientes') return !estado
    if (filtro === 'completadas') return estado === 'Completada'
    if (filtro === 'saltadas') return estado === 'Saltada'
    return true
  })

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-[var(--surface-2)] rounded-lg animate-pulse mb-6" />
        <div className="h-[400px] bg-[var(--surface-2)] rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-primary)]">Recorrida</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] text-[var(--ink-primary)] font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[var(--ink-primary)]">{stats.total}</p>
          <p className="text-xs text-[var(--ink-secondary)] mt-1">Total clientes</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[var(--brand)]">{stats.completadas}</p>
          <p className="text-xs text-[var(--ink-secondary)] mt-1">Visitados</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[var(--danger)]">{stats.saltadas}</p>
          <p className="text-xs text-[var(--ink-secondary)] mt-1">Saltados</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[var(--ink-muted)]">{stats.pendientes}</p>
          <p className="text-xs text-[var(--ink-secondary)] mt-1">Pendientes</p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden mb-6">
        <div className="h-[350px]">
          {clientesConUbicacion.length > 0 ? (
            <MapContainer
              center={[clientesConUbicacion[0].latitud, clientesConUbicacion[0].longitud]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationMarker />
              {clientesConUbicacion.map(c => (
                <Marker
                  key={c.id}
                  position={[c.latitud, c.longitud]}
                  icon={getIcono(getEstado(c.id))}
                >
                  <Popup>
                    <div className="text-center">
                      <p className="font-semibold">{c.nombre}</p>
                      {c.direccion && <p className="text-sm text-[var(--ink-secondary)]">{c.direccion}</p>}
                      {c.telefono && <p className="text-sm text-[var(--ink-secondary)]">{c.telefono}</p>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--ink-muted)]">
              <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <p className="text-sm">Agrega latitud y longitud a tus clientes para verlos en el mapa</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'pendientes', label: 'Pendientes' },
          { key: 'completadas', label: 'Visitados' },
          { key: 'saltadas', label: 'Saltados' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 ${
              filtro === f.key
                ? 'bg-[var(--brand)] text-white'
                : 'bg-[var(--surface-2)] text-[var(--ink-secondary)] hover:bg-[var(--surface)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {clientesFiltrados.length === 0 ? (
          <div className="text-center py-12 text-[var(--ink-muted)]">
            <p className="text-sm">No hay clientes para mostrar</p>
          </div>
        ) : (
          clientesFiltrados.map(cliente => {
            const estado = getEstado(cliente.id)
            return (
              <div
                key={cliente.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4"
              >
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  estado === 'Completada' ? 'bg-[#2d6a4f]'
                    : estado === 'Saltada' ? 'bg-[#c1292e]'
                    : 'bg-[#a09890]'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--ink-primary)] text-sm">{cliente.nombre}</p>
                  {cliente.direccion && (
                    <p className="text-xs text-[var(--ink-secondary)] truncate">{cliente.direccion}</p>
                  )}
                </div>
                <button
                  onClick={() => toggleVisita(cliente.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                    estado === 'Completada'
                      ? 'bg-[var(--brand)] text-white hover:opacity-90'
                      : estado === 'Saltada'
                      ? 'bg-[var(--danger-bg)] text-[var(--danger)] hover:opacity-90'
                      : 'bg-[var(--surface-2)] text-[var(--ink-secondary)] hover:bg-[var(--surface)]'
                  }`}
                >
                  {!estado ? 'Visitar' : estado === 'Completada' ? 'Hecho' : 'Saltado'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
