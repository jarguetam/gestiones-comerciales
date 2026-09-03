import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { boundsDe, type PuntoMapa } from '../../lib/mapa'
import { colorDeToken } from '../../lib/mapaTokens'
import type { ClienteMapa } from './puntosDemo'

const GT: L.LatLngExpression = [14.63, -90.51]

interface Props {
  ultimas: PuntoMapa[]
  recorrido: PuntoMapa[]
  clientes: ClienteMapa[]
  seleccionado: string | null
  onSelect: (usuarioId: string) => void
}

export function MapaLeaflet({ ultimas, recorrido, clientes, seleccionado, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const capas = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!el.current || mapRef.current) return
    const map = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(GT, 8)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)
    capas.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      capas.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const grupo = capas.current
    if (!map || !grupo) return
    grupo.clearLayers()

    const primary = colorDeToken('--gc-primary')
    const ink = colorDeToken('--gc-ink')
    const warn = colorDeToken('--gc-warn')
    const muted = colorDeToken('--gc-muted')

    for (const c of clientes) {
      L.circleMarker([c.lat, c.lng], {
        radius: 7,
        color: warn,
        fillColor: warn,
        fillOpacity: 0.9,
        weight: 1,
      })
        .bindTooltip(c.nombre)
        .addTo(grupo)
    }

    if (recorrido.length > 1) {
      L.polyline(
        recorrido.map((p) => [p.lat, p.lng] as L.LatLngExpression),
        { color: primary, weight: 3, opacity: 0.85 },
      ).addTo(grupo)
    }

    for (const p of ultimas) {
      const activo = p.usuarioId === seleccionado
      L.circleMarker([p.lat, p.lng], {
        radius: activo ? 10 : 8,
        color: activo ? primary : ink,
        fillColor: activo ? primary : muted,
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(`${p.nombre} · ${horaCorta(p.registradoEn)}`)
        .on('click', () => onSelect(p.usuarioId))
        .addTo(grupo)
    }

    const paraBounds = [
      ...ultimas,
      ...recorrido,
      ...clientes.map((c) => ({ lat: c.lat, lng: c.lng })),
    ]
    const b = boundsDe(paraBounds)
    if (b) {
      map.fitBounds(
        [
          [b.sur, b.oeste],
          [b.norte, b.este],
        ],
        { padding: [28, 28], maxZoom: 13 },
      )
    }
  }, [ultimas, recorrido, clientes, seleccionado, onSelect])

  return (
    <div
      ref={el}
      role="application"
      aria-label="Mapa de asesores"
      className="h-[min(70vh,36rem)] w-full rounded-2xl overflow-hidden border border-line bg-canvas isolate relative z-0"
    />
  )
}

function horaCorta(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
}
