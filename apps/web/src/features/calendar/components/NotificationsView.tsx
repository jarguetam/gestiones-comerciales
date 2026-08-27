import { StatusBar } from './StatusBar'
import { BottomNav } from './BottomNav'

interface NotificationsViewProps {
  onOpenNewEvent: () => void
  onNavigateTab: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications' | 'crm') => void
  embedded?: boolean
}

export function NotificationsView({
  onOpenNewEvent,
  onNavigateTab,
  embedded = false,
}: NotificationsViewProps) {
  const NOTIFS = [
    {
      id: '1',
      title: 'Recordatorio de visita',
      desc: 'En 20 minutos: "Verificación de garantías — Agropecuaria El Triunfo" (08:30 AM)',
      time: 'Hace 5 min',
      unread: true,
      color: 'bg-amber-500',
    },
    {
      id: '2',
      title: 'Check-in requerido',
      desc: 'Registra GPS al llegar a Km 56 Carretera a Puerto San José, Escuintla.',
      time: 'Hace 1 hora',
      unread: true,
      color: 'bg-brand-600',
    },
    {
      id: '3',
      title: 'Nueva asignación de persona',
      desc: 'Tu supervisor Erick Bardales te asignó la cuenta "Transportes El Norte".',
      time: 'Ayer',
      unread: false,
      color: 'bg-teal-500',
    },
    {
      id: '4',
      title: 'Visita rechazada',
      desc: 'El supervisor rechazó tu visita a "Comercial El Progreso": adjunta acta del acuerdo de pago.',
      time: 'Ayer',
      unread: false,
      color: 'bg-rose-500',
    },
    {
      id: '5',
      title: 'Aprobación de crédito',
      desc: '"Finca Santa Isabel" aprobó la renovación de Q 120,000 para ciclo 2027.',
      time: 'Hace 2 días',
      unread: false,
      color: 'bg-sky-500',
    },
  ]

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-hidden font-sans">
      {!embedded && <StatusBar theme="dark" />}

      <div className="px-6 pt-5 pb-3 border-b border-slate-100">
        <h1 className="text-xl font-serif font-semibold text-slate-900">
          Notificaciones
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Alertas y avisos de agenda en tiempo real
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {NOTIFS.map((n) => (
          <div
            key={n.id}
            className={`p-3.5 rounded-2xl border transition-all ${
              n.unread ? 'bg-purple-50/40 border-purple-100 shadow-xs' : 'bg-white border-slate-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.color}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-900">{n.title}</h4>
                  <span className="text-[10px] text-slate-400">{n.time}</span>
                </div>
                <p className="text-[12px] text-slate-600 mt-1 leading-snug">{n.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <BottomNav
        activeTab="notifications"
        onTabChange={onNavigateTab}
        onOpenNewEvent={onOpenNewEvent}
      />
    </div>
  )
}
