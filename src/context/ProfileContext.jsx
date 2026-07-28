import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const ProfileContext = createContext()

const PERMISOS = {
  admin:     { catalogo: true, carrito: true, clientes: true, pedidos: true, recorrida: true, adminProductos: true, adminUsuarios: true, adminDashboard: true, adminCobros: true },
  corredor:  { catalogo: true, carrito: true, clientes: true, pedidos: true, recorrida: true, adminProductos: false, adminUsuarios: false, adminDashboard: false, adminCobros: false },
  catalogo:  { catalogo: true, carrito: false, clientes: false, pedidos: false, recorrida: false, adminProductos: false, adminUsuarios: false, adminDashboard: false, adminCobros: false },
  consulta:  { catalogo: true, carrito: false, clientes: false, pedidos: false, recorrida: false, adminProductos: false, adminUsuarios: false, adminDashboard: false, adminCobros: false },
  dios:      { catalogo: true, carrito: true, clientes: true, pedidos: true, recorrida: true, adminProductos: true, adminUsuarios: true, adminDashboard: true, adminCobros: true },
}

const PERFIL_LABELS = {
  admin: 'Administrador',
  corredor: 'Corredor/Vendedor',
  catalogo: 'Gestor de Catálogo',
  consulta: 'Solo Consulta',
  dios: 'Dios',
}

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }

    const { data: authUser } = await supabase.auth.getUser()
    const email = authUser?.user?.email || ''

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (data) {
      if (data.activo === false) {
        setProfile({ ...data, activo: false, blocked: true, permisos: {} })
      } else {
        setProfile({ ...data, permisos: PERMISOS[data.perfil] || PERMISOS.consulta })
      }
    } else {
      const { error: insertError } = await supabase.from('usuarios').insert({
        id: userId,
        email,
        nombre: '',
        perfil: 'corredor',
        activo: true,
      })

      const { data: afterInsert } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (afterInsert) {
        setProfile({ ...afterInsert, permisos: PERMISOS[afterInsert.perfil] || PERMISOS.consulta })
      } else if (insertError) {
        setProfile({ id: userId, email, nombre: '', perfil: 'consulta', activo: true, permisos: PERMISOS.consulta })
      } else {
        setProfile({ id: userId, email, nombre: '', perfil: 'corredor', activo: true, permisos: PERMISOS.corredor })
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  const hasPermission = (perm) => {
    return profile?.permisos?.[perm] ?? false
  }

  return (
    <ProfileContext.Provider value={{ profile, loading, hasPermission, fetchProfile, PERFIL_LABELS, PERMISOS }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
