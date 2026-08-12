'use client'

import { useState } from 'react'
import { ArrowRight, Check, CheckCircle2, Circle, Factory, LockKeyhole, PackageCheck, Ruler, Truck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PROJECT_MACRO_PHASE_DESCRIPTIONS,
  PROJECT_MACRO_PHASE_LABELS,
  PROJECT_MACRO_PHASES,
  getProjectMacroPhaseIndex,
  getProjectNextAction,
  type ProjectMacroPhase,
  type ProjectPhaseTask,
  type ProjectWorkflowAction,
} from '@/lib/project-phases'

const PHASE_ICONS = {
  PREPARATION: Ruler,
  PRODUCTION: Factory,
  DELIVERY: Truck,
  COMPLETED: PackageCheck,
} satisfies Record<ProjectMacroPhase, typeof Ruler>

const ACTION_LABELS: Partial<Record<ProjectMacroPhase, string>> = {
  PREPARATION: 'Liberar para produção',
  PRODUCTION: 'Pronto para instalar',
  DELIVERY: 'Finalizar projeto',
}

type ProjectPhaseWorkspaceProps = {
  currentPhase: ProjectMacroPhase
  selectedPhase: ProjectMacroPhase
  tasks: ProjectPhaseTask[]
  blockers: string[]
  stageLabel: string
  deadlineLabel: string | null
  environmentProgress: number
  financialLabel: string | null
  workflowStatuses: {
    key: string
    label: string
    detail: string
    completed: boolean
    warning?: boolean
  }[]
  canOverridePhase: boolean
  advancing: boolean
  advanceError: string
  onSelect: (phase: ProjectMacroPhase) => void
  onAdvance: (overrideReason?: string) => Promise<void>
  onNextAction: (action: ProjectWorkflowAction) => void
  onEdit: () => void
}

export function ProjectPhaseWorkspace({
  currentPhase,
  selectedPhase,
  tasks,
  blockers,
  stageLabel,
  deadlineLabel,
  environmentProgress,
  financialLabel,
  workflowStatuses,
  canOverridePhase,
  advancing,
  advanceError,
  onSelect,
  onAdvance,
  onNextAction,
  onEdit,
}: ProjectPhaseWorkspaceProps) {
  const [showOverride, setShowOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const currentIndex = getProjectMacroPhaseIndex(currentPhase)
  const selectedIndex = getProjectMacroPhaseIndex(selectedPhase)
  const isCurrent = currentPhase === selectedPhase
  const isCompleted = selectedPhase === 'COMPLETED'
  const completedTasks = tasks.filter((task) => task.completed).length
  const nextTask = tasks.find((task) => task.required && !task.completed)
  const nextAction = getProjectNextAction(tasks, selectedPhase)
  const taskGroups = [
    { key: 'COMMERCIAL', label: 'Comercial' },
    { key: 'TECHNICAL', label: 'Técnico' },
    { key: 'OPERATIONAL', label: 'Operacional' },
  ].map((group) => ({ ...group, tasks: tasks.filter((task) => task.group === group.key) }))
    .filter((group) => group.tasks.length > 0)

  const submitOverride = async () => {
    if (overrideReason.trim().length < 5) return
    await onAdvance(overrideReason.trim())
    setOverrideReason('')
    setShowOverride(false)
  }

  return (
    <section className="overflow-hidden rounded-lg border border-[#E3E3E3] bg-white shadow-sm" aria-label="Fluxo do projeto">
      <div className="overflow-x-auto border-b border-[#EAEAEA]">
        <div className="grid min-w-[720px] grid-cols-4">
          {PROJECT_MACRO_PHASES.map((phase, index) => {
            const Icon = PHASE_ICONS[phase]
            const reached = index <= currentIndex
            const active = phase === selectedPhase
            const finished = index < currentIndex

            return (
              <button
                key={phase}
                type="button"
                disabled={!reached}
                onClick={() => reached && onSelect(phase)}
                className={`relative flex min-h-[78px] items-center gap-3 border-r border-[#EEEEEE] px-4 text-left transition-colors last:border-r-0 ${
                  active ? 'bg-[#FFF4EC]' : reached ? 'bg-white hover:bg-[#FAFAFA]' : 'cursor-not-allowed bg-[#F7F7F7] opacity-55'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  active ? 'bg-[#FF6B00] text-white' : finished ? 'bg-emerald-100 text-emerald-700' : 'bg-[#EEEEEE] text-[#777]'
                }`}>
                  {finished ? <Check size={17} /> : <Icon size={17} />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-xs font-semibold ${active ? 'text-[#C65300]' : 'text-[#222]'}`}>
                    {index + 1}. {PROJECT_MACRO_PHASE_LABELS[phase]}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-[#888]">
                    {phase === currentPhase ? 'Etapa atual' : finished ? 'Concluída' : 'Próxima etapa'}
                  </span>
                </span>
                {active ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#FF6B00]" /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-5">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#FF6B00]">
                {isCurrent ? 'O que fazer agora' : 'Consulta da etapa'}
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#121212]">{PROJECT_MACRO_PHASE_LABELS[selectedPhase]}</h2>
              <p className="mt-1 text-sm text-[#777]">{PROJECT_MACRO_PHASE_DESCRIPTIONS[selectedPhase]}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-[#777]">
              <span className="font-semibold text-[#121212]">{completedTasks}/{tasks.length}</span>
              tarefas concluídas
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {taskGroups.map((group) => (
              <div key={group.key}>
                <p className="mb-2 text-[10px] font-semibold uppercase text-[#999]">{group.label}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.tasks.map((task) => (
                    <div key={task.key} className={`flex min-h-11 items-center gap-2 border px-3 py-2 ${
                      task.completed ? 'border-emerald-100 bg-emerald-50/60' : task.required ? 'border-amber-200 bg-amber-50/70' : 'border-[#E8E8E8] bg-[#FAFAFA]'
                    }`}>
                      {task.completed
                        ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        : <Circle size={16} className={task.required ? 'shrink-0 text-amber-600' : 'shrink-0 text-[#AAA]'} />}
                      <span className={`text-xs font-medium ${task.completed ? 'text-emerald-800' : 'text-[#333]'}`}>{task.label}</span>
                      {!task.required && !task.completed ? <span className="ml-auto text-[10px] text-[#999]">Opcional</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {isCurrent ? (
            <div className={`mt-4 border-l-2 px-3 py-2.5 ${nextTask ? 'border-amber-500 bg-amber-50/70' : 'border-emerald-500 bg-emerald-50/70'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#777]">Próxima ação</p>
              <p className="mt-1 text-sm font-semibold text-[#121212]">
                {nextAction.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#666]">
                {nextAction.detail}
              </p>
              {!isCompleted ? (
                <Button type="button" size="sm" className="mt-3" loading={advancing && !nextTask} onClick={() => onNextAction(nextAction.action)}>
                  {nextAction.label}
                  <ArrowRight size={14} />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="border-l-0 border-[#EEEEEE] lg:border-l lg:pl-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">Resumo desta etapa</p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-[#888]">Status interno</dt><dd className="text-right font-semibold text-[#222]">{stageLabel}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[#888]">Ambientes</dt><dd className="font-semibold text-[#222]">{environmentProgress}%</dd></div>
            {deadlineLabel ? <div className="flex justify-between gap-3"><dt className="text-[#888]">Prazo</dt><dd className="text-right font-semibold text-[#222]">{deadlineLabel}</dd></div> : null}
            {financialLabel ? <div className="flex justify-between gap-3"><dt className="text-[#888]">Financeiro</dt><dd className="text-right font-semibold text-[#222]">{financialLabel}</dd></div> : null}
          </dl>

          <div className="mt-4 border-t border-[#EEEEEE] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">Aprovações e liberação</p>
            <div className="mt-2 space-y-2">
              {workflowStatuses.map((status) => (
                <div key={status.key} className="flex items-start gap-2">
                  {status.completed
                    ? <CheckCircle2 size={15} className={`mt-0.5 shrink-0 ${status.warning ? 'text-amber-600' : 'text-emerald-600'}`} />
                    : <Circle size={15} className="mt-0.5 shrink-0 text-amber-600" />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#222]">{status.label}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#777]">{status.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isCurrent && blockers.length > 0 ? (
            <div className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900"><LockKeyhole size={14} /> {blockers.length} pendência{blockers.length > 1 ? 's' : ''}</div>
              <p className="mt-1 text-[11px] leading-4 text-amber-800">Resolva os itens destacados para avançar com segurança.</p>
            </div>
          ) : null}

          {isCurrent && !isCompleted ? (
            <div className="mt-4 space-y-2">
              <Button type="button" className="w-full" loading={advancing} disabled={blockers.length > 0} onClick={() => void onAdvance()}>
                <CheckCircle2 size={15} />
                {ACTION_LABELS[selectedPhase]}
              </Button>
              {blockers.length > 0 && canOverridePhase ? (
                <button type="button" onClick={() => setShowOverride((value) => !value)} className="w-full text-center text-[11px] font-semibold text-[#777] hover:text-[#FF6B00]">
                  Liberar manualmente com justificativa
                </button>
              ) : null}
            </div>
          ) : null}

          {!isCurrent && selectedIndex < currentIndex ? (
            <div className="mt-4 flex items-center gap-2 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={15} /> Etapa já concluída
            </div>
          ) : null}

          {isCurrent && blockers.length > 0 ? (
            <button type="button" onClick={onEdit} className="mt-3 w-full text-center text-[11px] font-semibold text-[#FF6B00] hover:underline">
              Editar dados do projeto
            </button>
          ) : null}
          {advanceError ? <p className="mt-3 text-xs text-red-600">{advanceError}</p> : null}
        </aside>
      </div>

      {showOverride && canOverridePhase ? (
        <div className="border-t border-amber-200 bg-amber-50 p-4">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-950">Avanço manual</p>
                <p className="mt-1 text-xs text-amber-800">Explique por que o projeto pode avançar mesmo com pendências. A justificativa ficará no histórico.</p>
              </div>
              <button type="button" onClick={() => setShowOverride(false)} title="Fechar"><X size={16} /></button>
            </div>
            <textarea
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ex.: cliente autorizou iniciar enquanto aguardamos o arquivo final."
              className="mt-3 w-full resize-none border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#FF6B00]"
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowOverride(false)}>Cancelar</Button>
              <Button type="button" size="sm" loading={advancing} disabled={overrideReason.trim().length < 5} onClick={() => void submitOverride()}>
                Confirmar e avançar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
