import { CrmPipelineView } from './CrmPipelineView'
import { useDominio } from '../../app/DominioContext'

export function CrmPage() {
  const { leads, setLeads, abrirNuevaVisita, convertirLead } = useDominio()
  return (
    <CrmPipelineView
      leads={leads}
      onChangeLeads={setLeads}
      onConvertLead={convertirLead}
      onOpenNewEvent={() => abrirNuevaVisita()}
    />
  )
}
