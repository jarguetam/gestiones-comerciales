import type { CalendarEvent } from '../types'
import { PhoneMockup } from './PhoneMockup'
import { AgendaView } from './AgendaView'
import { TimelineView } from './TimelineView'
import { EventDetailView } from './EventDetailView'

interface Showcase3PhonesProps {
  events: CalendarEvent[]
  selectedEvent: CalendarEvent
  selectedDate: string
  onDateChange: (date: string) => void
  onSelectEvent: (event: CalendarEvent) => void
  onOpenNewEvent: () => void
  onNavigateTab: (tab: 'agenda' | 'timeline' | 'personas' | 'search' | 'notifications') => void
  onCloseDetail: () => void
}

export function Showcase3Phones({
  events,
  selectedEvent,
  selectedDate,
  onDateChange,
  onSelectEvent,
  onOpenNewEvent,
  onNavigateTab,
  onCloseDetail,
}: Showcase3PhonesProps) {
  return (
    <div className="w-full flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-x-auto min-h-screen bg-gradient-to-br from-[#C8B6FF] via-[#DDD6FE] to-[#C084FC]">
      <div className="flex flex-col xl:flex-row items-center justify-center gap-8 lg:gap-12 max-w-7xl mx-auto">
        {/* Phone 1 (Left) - Multi-Month Agenda View */}
        <div className="transform transition-transform hover:-translate-y-1 duration-300">
          <PhoneMockup>
            <AgendaView
              events={events}
              onSelectEvent={onSelectEvent}
              onOpenNewEvent={onOpenNewEvent}
              onNavigateTab={onNavigateTab}
            />
          </PhoneMockup>
        </div>

        {/* Phone 2 (Center) - Daily Timeline / Hourly Schedule View */}
        <div className="transform transition-transform hover:-translate-y-1 duration-300 xl:-mt-2">
          <PhoneMockup>
            <TimelineView
              events={events}
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              onSelectEvent={onSelectEvent}
              onOpenNewEvent={onOpenNewEvent}
              onNavigateTab={onNavigateTab}
            />
          </PhoneMockup>
        </div>

        {/* Phone 3 (Right) - Event Detail Screen */}
        <div className="transform transition-transform hover:-translate-y-1 duration-300">
          <PhoneMockup>
            <EventDetailView
              event={selectedEvent}
              onClose={onCloseDetail}
              onEdit={onSelectEvent}
            />
          </PhoneMockup>
        </div>
      </div>
    </div>
  )
}