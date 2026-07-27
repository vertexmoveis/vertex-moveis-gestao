import Link from 'next/link'
import { MessageCircle, Phone, Send } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

type ProjectClientCardProps = {
  client: {
    id: string
    name: string
    phone: string | null
  }
  whatsAppNumber: string | null
  approvalMessage: string
  approvalReminderMessage: string
}

function whatsAppLink(phone: string, message?: string) {
  const params = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${phone}${params}`
}

export function ProjectClientCard({
  client,
  whatsAppNumber,
  approvalMessage,
  approvalReminderMessage,
}: ProjectClientCardProps) {
  return (
    <Card id="cliente" className="scroll-mt-28">
      <CardHeader>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9E9E9E]">Cliente</p>
          <Link href={`/dashboard/clients/${client.id}`} className="text-xs text-[#FF6B00] hover:underline">
            Ver perfil
          </Link>
        </div>
      </CardHeader>
      <CardBody>
        <div className="mb-3 flex items-center gap-3">
          <Avatar name={client.name} size="md" />
          <p className="text-sm font-semibold text-[#121212]">{client.name}</p>
        </div>
        <div className="space-y-2">
          {client.phone ? (
            <div className="flex items-center gap-2 text-xs text-[#9E9E9E]">
              <Phone size={12} />{client.phone}
            </div>
          ) : null}
          {whatsAppNumber ? (
            <>
              <a
                href={whatsAppLink(whatsAppNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-green-600 hover:underline"
              >
                <MessageCircle size={12} />WhatsApp
              </a>
              <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                <a
                  href={whatsAppLink(whatsAppNumber, approvalMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#FF6B00] px-3 text-xs font-semibold text-[#FF6B00] transition-colors hover:bg-[#FFF3EA]"
                >
                  <Send size={13} />
                  Pedir aprovação
                </a>
                <a
                  href={whatsAppLink(whatsAppNumber, approvalReminderMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] px-3 text-xs font-semibold text-[#121212] transition-colors hover:border-[#FF6B00] hover:text-[#FF6B00]"
                >
                  <MessageCircle size={13} />
                  Cobrar aprovação
                </a>
              </div>
            </>
          ) : null}
        </div>
      </CardBody>
    </Card>
  )
}
