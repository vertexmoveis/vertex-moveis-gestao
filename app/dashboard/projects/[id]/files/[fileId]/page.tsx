import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Download } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { ProjectFileViewer } from '@/components/projects/project-file-viewer'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PROJECT_FILE_CATEGORY_LABELS, projectFileDisplayName, type ProjectFileCategory } from '@/lib/project-files'
import { canDownloadProjectFile } from '@/lib/project-file-security'
import { canAccessProject, type AuthenticatedUser } from '@/lib/security'
import { formatDate } from '@/lib/utils'

function formatFileSize(size: number | null) {
  if (size === null) return 'Tamanho não informado'
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

export default async function ProjectFilePage({
  params,
}: {
  params: Promise<{ id: string; fileId: string }>
}) {
  const session = await getServerSession(authOptions)
  const user = session?.user as Partial<AuthenticatedUser> | undefined
  const { id, fileId } = await params

  if (!user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/dashboard/projects/${id}/files/${fileId}`)}`)

  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId: id, project: { archivedAt: null } },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          managerId: true,
          client: { select: { name: true } },
        },
      },
    },
  })

  const authenticatedUser: AuthenticatedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'MANAGER',
  }

  if (!file || !canAccessProject(authenticatedUser, file.project.managerId)) notFound()

  const sourceUrl = `/api/projects/${id}/files/${file.id}`
  const released = canDownloadProjectFile(file.type, file.securityStatus)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header
        title={projectFileDisplayName(file.name)}
        subtitle={`${file.project.name} · ${file.project.client.name}`}
        userName={authenticatedUser.name || ''}
      />
      <main className="min-h-0 flex-1 overflow-y-auto bg-[#F5F5F5] p-4 lg:p-6">
        <div className="mx-auto max-w-[1500px] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/dashboard/projects/${id}#arquivos`}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#4A4A4A] transition-colors hover:bg-white hover:text-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
            >
              <ArrowLeft size={16} /> Voltar aos arquivos
            </Link>
            {released ? (
              <a
                href={`${sourceUrl}?download=1`}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D9D9D9] bg-white px-4 text-sm font-semibold text-[#121212] transition-colors hover:border-[#BDBDBD] hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
              >
                <Download size={16} /> Baixar
              </a>
            ) : null}
          </div>

          <section className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[#E8E8E8] px-4 py-3 lg:px-5">
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold text-[#121212]" title={file.name}>{file.name}</h1>
                <p className="mt-0.5 text-xs text-[#777777]">
                  {PROJECT_FILE_CATEGORY_LABELS[file.category as ProjectFileCategory] || 'Outros arquivos'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#6B6B6B]">
                <span>{formatFileSize(file.size)}</span>
                <span>Adicionado em {formatDate(file.createdAt)}</span>
              </div>
            </div>
            <ProjectFileViewer name={file.name} type={file.type} sourceUrl={sourceUrl} released={released} />
          </section>
        </div>
      </main>
    </div>
  )
}
