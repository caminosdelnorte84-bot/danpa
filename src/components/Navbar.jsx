import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useTheme } from '../context/ThemeContext'
import { useProfile } from '../context/ProfileContext'

export default function Navbar() {
  const location = useLocation()
  const { itemCount } = useCart()
  const { dark, toggle } = useTheme()
  const { profile, hasPermission } = useProfile()

  const links = [
    { to: '/', label: 'Catálogo', perm: 'catalogo' },
    { to: '/ventas', label: 'Ventas', perm: 'carrito' },
    { to: '/recorrida', label: 'Recorrida', perm: 'recorrida' },
    { to: '/pedidos', label: 'Pedidos', perm: 'pedidos' },
    { to: '/clientes', label: 'Clientes', perm: 'clientes' },
  ].filter(link => hasPermission(link.perm))

  if (hasPermission('adminDashboard')) {
    links.push({ to: '/admin/dashboard', label: 'Dashboard', perm: 'adminDashboard' })
  }

  if (hasPermission('adminProductos')) {
    links.push({ to: '/admin/productos', label: 'Productos', perm: 'adminProductos' })
  }

  if (hasPermission('adminUsuarios')) {
    links.push({ to: '/admin/usuarios', label: 'Usuarios', perm: 'adminUsuarios' })
  }

  if (hasPermission('adminCobros')) {
    links.push({ to: '/admin/cobros', label: 'Cobros', perm: 'adminCobros' })
  }

  const perfilLabel = {
    dios: 'Dios',
    admin: 'Admin',
    corredor: 'Corredor',
    catalogo: 'Catálogo',
    consulta: 'Consulta',
  }

  return (
    <nav className="sticky top-0 z-50" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-1.5 group">
          <span className="w-2 h-2 rounded-full transition-transform duration-150 group-hover:scale-110" style={{ background: 'var(--brand)' }} />
          <span className="text-lg font-semibold tracking-[-0.02em]" style={{ color: 'var(--ink-primary)' }}>
            danpa
          </span>
          {profile && (
            <span className="ml-1.5 text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
              {perfilLabel[profile.perfil] || profile.perfil}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = link.to === '/' ? location.pathname === '/' : location.pathname.startsWith(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                className="relative px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
                style={isActive
                  ? { background: 'var(--brand)', color: '#ffffff' }
                  : { color: 'var(--ink-secondary)' }
                }
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink-primary)' } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-secondary)' } }}
              >
                {link.label}
                {link.to === '/ventas' && itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white rounded-full leading-none animate-[pulse_200ms_ease-out]" style={{ background: 'var(--brand)' }}>
                    {itemCount}
                  </span>
                )}
              </Link>
            )
          })}

          <button
            onClick={toggle}
            className="ml-2 p-1.5 rounded-lg transition-colors duration-150"
            style={{ color: 'var(--ink-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--ink-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-muted)'}
            title={dark ? 'Modo claro' : 'Modo oscuro'}
          >
            {dark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

        </div>
      </div>
    </nav>
  )
}
