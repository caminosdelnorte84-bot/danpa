import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../services/supabase'
import { useProfile } from '../context/ProfileContext'

const PERFIL_OPTIONS = [
  { value: 'dios', label: 'Dios' },
  { value: 'admin', label: 'Administrador' },
  { value: 'corredor', label: 'Corredor/Vendedor' },
  { value: 'catalogo', label: 'Gestor de Catálogo' },
  { value: 'consulta', label: 'Solo Consulta' },
]

const PERFIL_COLORS = {
  dios: { bg: 'var(--danger-bg)', text: 'var(--danger)' },
  admin: { bg: 'var(--brand-light)', text: 'var(--brand)' },
  corredor: { bg: 'var(--surface-2)', text: 'var(--ink-secondary)' },
  catalogo: { bg: 'var(--info-bg)', text: 'var(--info-text)' },
  consulta: { bg: 'var(--warning-bg)', text: 'var(--warning-text)' },
}

export default function UsuariosAdmin() {
  const { profile: currentProfile, PERFIL_LABELS } = useProfile()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [formEdit, setFormEdit] = useState({ perfil: '', nombre: '' })
  const [showCrear, setShowCrear] = useState(false)
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoPass, setNuevoPass] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoPerfil, setNuevoPerfil] = useState('corredor')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState('')
  const [exitoCrear, setExitoCrear] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('todos')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false })
      if (!cancelled) {
        setUsuarios(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const fetchUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false })
    setUsuarios(data || [])
  }

  const filtrados = useMemo(() => {
    return usuarios.filter(u => {
      const matchBusqueda = busqueda === '' ||
        u.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.nombre?.toLowerCase().includes(busqueda.toLowerCase())
      const matchPerfil = filtroPerfil === 'todos' || u.perfil === filtroPerfil
      return matchBusqueda && matchPerfil
    })
  }, [usuarios, busqueda, filtroPerfil])

  const totalUsuarios = usuarios.length
  const activos = usuarios.filter(u => u.activo).length
  const inactivos = usuarios.filter(u => !u.activo).length
  const porPerfil = PERFIL_OPTIONS.map(p => ({
    ...p,
    count: usuarios.filter(u => u.perfil === p.value).length,
  }))

  const handleGuardar = async (id) => {
    if (id === currentProfile?.id && formEdit.perfil !== currentProfile?.perfil) {
      alert('No puedes cambiar tu propio perfil')
      return
    }
    if (formEdit.perfil !== 'admin' && usuarios.filter(u => u.perfil === 'admin').length <= 1 && usuarios.find(u => u.id === id)?.perfil === 'admin') {
      alert('No se puede degradar al único administrador')
      return
    }
    try {
      const updates = { perfil: formEdit.perfil }
      if (formEdit.nombre !== undefined) updates.nombre = formEdit.nombre
      await supabase.from('usuarios').update(updates).eq('id', id)
      setEditando(null)
      await fetchUsuarios()
    } catch (err) {
      alert('Error al guardar usuario: ' + err.message)
    }
  }

  const toggleActivo = async (id, activo, email) => {
    if (id === currentProfile?.id) {
      alert('No puedes desactivar tu propia cuenta')
      return
    }
    const accion = activo ? 'desactivar' : 'activar'
    if (!confirm(`¿Estás seguro de ${accion} al usuario ${email}?`)) return
    try {
      await supabase.from('usuarios').update({ activo: !activo }).eq('id', id)
      await fetchUsuarios()
    } catch (err) {
      alert('Error al cambiar estado: ' + err.message)
    }
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    setCreando(true)
    setErrorCrear('')
    setExitoCrear('')

    const { data, error } = await supabase.auth.signUp({
      email: nuevoEmail,
      password: nuevoPass,
    })

    if (error) {
      setErrorCrear(error.message)
      setCreando(false)
      return
    }

    if (data.user) {
      const { error: insertError } = await supabase.from('usuarios').insert({
        id: data.user.id,
        email: nuevoEmail,
        nombre: nuevoNombre,
        perfil: nuevoPerfil,
        activo: true,
      })

      if (insertError) {
        setErrorCrear('Usuario creado pero no se pudo asignar perfil: ' + insertError.message)
      } else {
        setExitoCrear('Usuario ' + nuevoEmail + ' creado con perfil ' + PERFIL_LABELS[nuevoPerfil])
      }
    }

    setNuevoEmail('')
    setNuevoPass('')
    setNuevoNombre('')
    setNuevoPerfil('corredor')
    setCreando(false)
    await fetchUsuarios()
  }

  const perfilBadge = (perfil) => {
    const c = PERFIL_COLORS[perfil] || PERFIL_COLORS.consulta
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: c.bg, color: c.text }}>
        {PERFIL_LABELS[perfil] || perfil}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="h-8 w-48 rounded-lg animate-pulse mb-6" style={{ background: 'var(--surface-2)' }} />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
            Gestión de Usuarios
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-secondary)' }}>
            Administra los perfiles y accesos de los usuarios
          </p>
        </div>
        <button
          onClick={() => setShowCrear(!showCrear)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition"
          style={{ background: 'var(--brand)' }}
        >
          {showCrear ? 'Cancelar' : '+ Crear usuario'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {[
          { label: 'Total', value: totalUsuarios, color: 'var(--ink-primary)' },
          { label: 'Activos', value: activos, color: 'var(--success-text)' },
          { label: 'Inactivos', value: inactivos, color: 'var(--danger)' },
          ...porPerfil.map(p => ({ label: p.label.split(' ')[0], value: p.count, color: PERFIL_COLORS[p.value]?.text || 'var(--ink-muted)' })),
        ].map((c, i) => (
          <div key={i} className="p-3 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>{c.label}</p>
            <p className="text-lg font-bold mt-1 tabular-nums" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {showCrear && (
        <form onSubmit={handleCrear} className="mb-6 p-5 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-primary)' }}>Nuevo usuario</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input type="email" placeholder="Email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} required
              className="px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
            <input type="password" placeholder="Contraseña (mín. 6 caracteres)" value={nuevoPass} onChange={e => setNuevoPass(e.target.value)} required minLength={6}
              className="px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
            <input type="text" placeholder="Nombre completo" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
            <select value={nuevoPerfil} onChange={e => setNuevoPerfil(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border appearance-none cursor-pointer"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
              {PERFIL_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {errorCrear && <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>{errorCrear}</p>}
          {exitoCrear && <p className="mt-2 text-xs" style={{ color: 'var(--success-text)' }}>{exitoCrear}</p>}
          <button type="submit" disabled={creando}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
            style={{ background: 'var(--brand)' }}>
            {creando ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ink-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" placeholder="Buscar por email o nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{ value: 'todos', label: 'Todos' }, ...PERFIL_OPTIONS].map(p => (
            <button key={p.value} onClick={() => setFiltroPerfil(p.value)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition"
              style={filtroPerfil === p.value ? { background: 'var(--brand)', color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--ink-secondary)' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-secondary)' }}>Usuario</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-secondary)' }}>Nombre</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-secondary)' }}>Perfil</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-secondary)' }}>Estado</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-secondary)' }}>Registro</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-secondary)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(usuario => (
                <tr key={usuario.id} className="border-t transition-colors hover:bg-[var(--hover-subtle)]"
                  style={{ borderColor: 'var(--border)' }}>
                  <td className="px-5 py-3">
                    <p className="font-semibold" style={{ color: 'var(--ink-primary)' }}>{usuario.email}</p>
                    {usuario.id === currentProfile?.id && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>Tú</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {editando === usuario.id ? (
                      <input type="text" value={formEdit.nombre} onChange={e => setFormEdit({ ...formEdit, nombre: e.target.value })}
                        placeholder="Nombre completo"
                        className="w-full px-2 py-1 rounded text-xs border outline-none"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
                    ) : (
                      <span className="text-xs" style={{ color: usuario.nombre ? 'var(--ink-primary)' : 'var(--ink-muted)' }}>
                        {usuario.nombre || 'Sin nombre'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {editando === usuario.id ? (
                      <div className="flex items-center gap-2">
                        <select value={formEdit.perfil} onChange={e => setFormEdit({ ...formEdit, perfil: e.target.value })}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border appearance-none cursor-pointer"
                          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
                          {PERFIL_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </div>
                    ) : (
                      perfilBadge(usuario.perfil)
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => toggleActivo(usuario.id, usuario.activo, usuario.email)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition"
                      style={usuario.activo ? { background: 'var(--success-bg)', color: 'var(--success-text)' } : { background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs tabular-nums" style={{ color: 'var(--ink-muted)' }}>
                      {new Date(usuario.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {editando === usuario.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => handleGuardar(usuario.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition"
                          style={{ background: 'var(--brand)' }}>Guardar</button>
                        <button onClick={() => setEditando(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                          style={{ background: 'var(--surface-2)', color: 'var(--ink-secondary)' }}>Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditando(usuario.id); setFormEdit({ perfil: usuario.perfil, nombre: usuario.nombre || '' }) }}
                        className="text-xs font-medium transition px-3 py-1.5 rounded-lg"
                        style={{ color: 'var(--brand)' }}>
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length === 0 && (
          <div className="text-center py-12">
            <p style={{ color: 'var(--ink-muted)' }}>{busqueda || filtroPerfil !== 'todos' ? 'No se encontraron usuarios con esos filtros' : 'No hay usuarios registrados'}</p>
          </div>
        )}
      </div>
    </div>
  )
}