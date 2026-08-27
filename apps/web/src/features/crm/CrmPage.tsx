import { CrmPipelineView } from '../calendar/components/CrmPipelineView'
import { useDominio } from '../../app/DominioContext'

export function CrmPage() {
  const { leads, setLeads, abrirNuevaVisita, convertirLead } = useDominio()
  return (
    <div className="h-[calc(100vh-8rem)] rounded-2xl border border-[#E4DCC8] overflow-hidden bg-white relative">
      <CrmPipelineView
        embedded
        leads={leads}
        onChangeLeads={setLeads}
        onConvertLead={convertirLead}
        onOpenNewEvent={() => abrirNuevaVisita()}
        onNavigateTab={() => undefined}
      />
    </div>
  )
}
