import { PersonasView } from '../calendar/components/PersonasView'
import { useDominio } from '../../app/DominioContext'

export function PersonasPage() {
  const { personas, abrirNuevaVisita } = useDominio()
  return (
    <div className="max-w-3xl h-[calc(100vh-8rem)] rounded-2xl border border-[#E4DCC8] overflow-hidden bg-white relative">
      <PersonasView
        embedded
        personas={personas}
        onOpenNewEvent={() => abrirNuevaVisita()}
        onNavigateTab={() => undefined}
        onScheduleWithPersona={(nombre) => abrirNuevaVisita(nombre)}
      />
    </div>
  )
}
