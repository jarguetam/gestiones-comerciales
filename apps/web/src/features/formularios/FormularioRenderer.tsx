import type { CampoEsquema } from '../../lib/formulario'
import { fieldClass } from '../../components/ui'

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
                className="h-4 w-4 accent-primary"
              />
              {campo.etiqueta}
              {requerido}
            </label>
          )
        }

        return (
          <div key={campo.clave}>
            <label htmlFor={campo.clave} className="block text-sm font-medium text-ink">
              {campo.etiqueta}
              {requerido}
            </label>
            {campo.tipo === 'seleccion' ? (
              <select
                id={campo.clave}
                className={fieldClass}
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
                className={fieldClass}
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
                className={fieldClass}
                disabled={disabled}
                value={typeof valor === 'string' ? valor : ''}
                onChange={(e) => onChange(campo.clave, e.target.value || undefined)}
              />
            ) : (
              <input
                id={campo.clave}
                type="text"
                className={fieldClass}
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
