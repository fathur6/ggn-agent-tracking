import { type ElementType } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { LayoutDashboard, Users, FormInput, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: ElementType
  adminOnly?: boolean
}

export function Sidebar() {
  const { user } = useAuth()

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/leads', label: 'My Leads', icon: Users },
    { to: '/forms', label: 'My Forms', icon: FormInput },
    { to: '/agents', label: 'All Agents', icon: GraduationCap, adminOnly: true },
  ]

  const visible = navItems.filter(item => !item.adminOnly || user?.role === 'admin')

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col h-screen">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-primary">UniSZA Graduate School</h1>
        <p className="text-xs text-muted mt-1">Agent Tracking System</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {visible.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-border/30',
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
