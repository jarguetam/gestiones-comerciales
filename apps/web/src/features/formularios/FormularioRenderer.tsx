import type { CampoEsquema } from '../../lib/formulario'

const INPUT =
  'mt-1 w-full rounded-lg border border-[#E4DCC8] bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700'

interface Props {
  campos: CampoEsquema[]
  valores: Record<string, unknown>
  onChange: (clave: string, valor: unknown) => void
  disabled?: boolean
}

export function FormularioRenderer({ campos, valores, onChange, disabled }: Props) {
  return (
    <div className="space-y-4">
      {campos.map((campo) => {
        const requerido = campo.requerido ? ' *' : ''
        const valor = valores[campo.clave]

        if (campo.tipo === 'booleano') {
          return (
            <label key={campo.clave} htmlFor={campo.clave} className="flex items-center gap-2 text-sm font-medium">
              <input
                id={campo.clave}
                type="checkbox"
                checked={valor === true}
                disabled={disabled}
                onChange={(e) => onChange(campo.clave, e.target.checked)}
                className="h-4 w-4 accent-brand-700"
              />
              {campo.etiqueta}
              {requerido}
            </label>
          )
        }

        return (
          <div key={campo.clave}>
            <label htmlFor={campo.clave} className="block text-sm font-medium text-slate-700">
              {campo.etiqueta}
              {requerido}
            </label>
            {campo.tipo === 'seleccion' ? (
              <select
                id={campo.clave}
                className={INPUT}
                disabled={disabled}
                value={typeof valor === 'string' ? valor : ''}
                onChange={(e) => onChange(campo.clave, e.target.value || undefined)}
              >
                <option value="">Seleccionar…</option>
                {(campo.opciones ?? []).map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            ) : campo.tipo === 'numero' ? (
              <input
                id={campo.clave}
                type="number"
                className={INPUT}
                disabled={disabled}
                min={campo.min}
                max={campo.max}
                step="any"
                value={typeof valor === 'number' ? String(valor) : ''}
                onChange={(e) => {
                  const t = e.target.value
                  onChange(campo.clave, t === '' ? undefined : Number(t))
                }}
              />
            ) : campo.tipo === 'fecha' ? (
              <input
                id={campo.clave}
                type="date"
                className={INPUT}
                disabled={disabled}
                value={typeof valor === 'string' ? valor : ''}
                onChange={(e) => onChange(campo.clave, e.target.value || undefined)}
              />
            ) : (
              <input
                id={campo.clave}
                type="text"
                className={INPUT}
                disabled={disabled}
                value={typeof valor === 'string' ? valor : ''}
                onChange={(e) => onChange(campo.clave, e.target.value || undefined)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
