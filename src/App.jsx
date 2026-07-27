import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './services/supabase'
import { CartProvider } from './context/CartContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProfileProvider } from './context/ProfileContext'
import Navbar from './components/Navbar'
import Catalogo from './pages/Catalogo'
import Carrito from './pages/Carrito'
import Pedidos from './pages/Pedidos'
import Clientes from './pages/Clientes'
import ClienteDetalle from './pages/ClienteDetalle'
import Recorrida from './pages/Recorrida'
import ProductosAdmin from './pages/ProductosAdmin'
import AdminDashboard from './pages/AdminDashboard'
import UsuariosAdmin from './pages/UsuariosAdmin'
import CobrosAdmin from './pages/CobrosAdmin'
import { useProfile } from './context/ProfileContext'

const AUTO_EMAIL = import.meta.env.VITE_AUTO_LOGIN_EMAIL
const AUTO_PASS = import.meta.env.VITE_AUTO_LOGIN_PASSWORD

function AppContent() {
  const { loading: profileLoading } = useProfile()

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-2" style={{ borderColor: 'var(--surface-2)', borderTopColor: 'var(--brand)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink-primary)' }}>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Catalogo />} />
          <Route path="/carrito" element={<Carrito />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/:id" element={<ClienteDetalle />} />
          <Route path="/recorrida" element={<Recorrida />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/productos" element={<ProductosAdmin />} />
          <Route path="/admin/usuarios" element={<UsuariosAdmin />} />
          <Route path="/admin/cobros" element={<CobrosAdmin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) { setReady(true); return }

      if (AUTO_EMAIL && AUTO_PASS) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: AUTO_EMAIL,
          password: AUTO_PASS,
        })
        if (loginError?.message?.includes('Invalid login credentials')) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: AUTO_EMAIL,
            password: AUTO_PASS,
          })
          if (signUpError) {
            setError('No se pudo crear el usuario: ' + signUpError.message)
            return
          }
          if (signUpData?.user) {
            const { error: insertError } = await supabase.from('usuarios').insert({
              id: signUpData.user.id,
              email: AUTO_EMAIL,
              nombre: 'Admin',
              perfil: 'dios',
              activo: true,
            })
            if (insertError) console.error('Error al insertar perfil:', insertError.message)
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: AUTO_EMAIL,
              password: AUTO_PASS,
            })
            if (retryError) { setError('Error al iniciar sesión: ' + retryError.message); return }
          }
        } else if (loginError) {
          setError('Error de auto-login: ' + loginError.message)
          return
        }
        setReady(true)
      } else {
        const { error: anonError } = await supabase.auth.signInAnonymously()
        if (anonError) {
          setError('No hay sesión activa y no se pudo iniciar sesión anónima. Configurá VITE_AUTO_LOGIN_EMAIL y VITE_AUTO_LOGIN_PASSWORD en .env')
          return
        }
        setReady(true)
      }
    })()
  }, [])

  return (
    <ThemeProvider>
      <BrowserRouter>
        {error ? (
          <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
            <div className="max-w-md text-center">
              <p className="text-6xl mb-4">&#x26A0;&#xFE0F;</p>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ink-primary)' }}>Error de autenticación</h2>
              <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>{error}</p>
            </div>
          </div>
        ) : !ready ? (
          <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
            <div className="animate-spin rounded-full h-10 w-10 border-2" style={{ borderColor: 'var(--surface-2)', borderTopColor: 'var(--brand)' }} />
          </div>
        ) : (
          <ProfileProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </ProfileProvider>
        )}
      </BrowserRouter>
    </ThemeProvider>
  )
}
