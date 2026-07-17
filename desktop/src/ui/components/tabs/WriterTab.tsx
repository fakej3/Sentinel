import { useState, useMemo } from 'react'
import { FileText, Hash, AlignLeft, List, BookOpen, X, Sparkles } from 'lucide-react'
import { Card } from '../shared/Card'
import { CopyButton } from '../shared/CopyButton'
import { clsx } from 'clsx'
import type { PipelineResult, WriterTemplate } from '../../types'

interface WriterTabProps {
  result: PipelineResult
}

interface TemplateDef {
  id: WriterTemplate
  label: string
  icon: React.ReactNode
  description: string
}

const TEMPLATES: TemplateDef[] = [
  { id: 'headline', label: 'Headline', icon: <Hash size={13} />, description: 'One-line title' },
  { id: 'social', label: 'Social', icon: <X size={13} />, description: 'Short post format' },
  { id: 'bullet', label: 'Bullet', icon: <List size={13} />, description: '5–7 key facts' },
  { id: 'summary', label: 'Summary', icon: <AlignLeft size={13} />, description: 'Narrative paragraph' },
  { id: 'executive', label: 'Executive', icon: <BookOpen size={13} />, description: 'Professional overview' },
  { id: 'full', label: 'Full', icon: <FileText size={13} />, description: 'Complete report' },
]

function buildTemplateContent(ga: PipelineResult['generatedAnalysis'], template: WriterTemplate): string {
  const { headline, summary, trendSection, indicatorSection, marketStructureSection,
    supportResistanceSection, volumeSection, riskSection, confidenceSection,
    conclusion } = ga

  switch (template) {
    case 'headline':
      return headline

    case 'social':
      return `${headline}\n\n${summary.split('.').slice(0, 2).join('.')}.\n\n${conclusion.split('.')[0]}.`

    case 'bullet': {
      const bullets = [
        `📊 Trend: ${trendSection.split('\n')[0].replace(/^#+\s*/, '').trim()}`,
        `💡 ${indicatorSection.split('\n').find(l => l.trim().length > 20) ?? indicatorSection.split('\n')[0]}`,
        `🏗️ ${marketStructureSection.split('\n').find(l => l.trim().length > 20) ?? marketStructureSection.split('\n')[0]}`,
        `📍 ${supportResistanceSection.split('\n').find(l => l.trim().length > 20) ?? supportResistanceSection.split('\n')[0]}`,
        `📦 ${volumeSection.split('\n').find(l => l.trim().length > 20) ?? volumeSection.split('\n')[0]}`,
        `⚠️ ${riskSection.split('\n').find(l => l.trim().length > 20) ?? riskSection.split('\n')[0]}`,
        `✅ ${conclusion.split('.')[0]}.`,
      ]
      return `${headline}\n\n${bullets.join('\n')}`
    }

    case 'summary':
      return `${headline}\n\n${summary}\n\n${conclusion}`

    case 'executive':
      return [headline, '', summary, '', trendSection, '', confidenceSection, '', riskSection, '', conclusion].join('\n')

    case 'full':
      return ga.fullReport
  }
}

function ReportSection({ title, content, defaultExpanded = false }: { title: string; content: string; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  if (!content.trim()) return null
  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-700 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{title}</span>
        <div className="flex items-center gap-2">
          <CopyButton text={content} />
          <span className="text-slate-600 text-xs">{expanded ? '−' : '+'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{content}</pre>
        </div>
      )}
    </div>
  )
}

export function WriterTab({ result }: WriterTabProps) {
  const { generatedAnalysis } = result
  const [activeTemplate, setActiveTemplate] = useState<WriterTemplate>(
    generatedAnalysis.metadata.template,
  )

  const content = useMemo(
    () => buildTemplateContent(generatedAnalysis, activeTemplate),
    [generatedAnalysis, activeTemplate],
  )
  const isGenerated = activeTemplate === generatedAnalysis.metadata.template

  return (
    <div className="p-4 space-y-4 animate-in">
      {/* Template Selector */}
      <Card className="p-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTemplate(t.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                activeTemplate === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-600',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            {generatedAnalysis.aiEnhanced && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-violet-400/10 text-violet-400">
                <Sparkles size={9} />
                AI enhanced
              </span>
            )}
            <span className={clsx(
              'text-[10px] px-2 py-1 rounded-full',
              isGenerated
                ? 'bg-emerald-400/10 text-emerald-400'
                : 'bg-amber-400/10 text-amber-400',
            )}>
              {isGenerated ? '✓ Engine output' : '⚡ UI composed'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-600 mt-2 pl-0.5">
          {TEMPLATES.find(t => t.id === activeTemplate)?.description}
          {!isGenerated && ' · Composed from engine sections (not the original API response)'}
        </p>
      </Card>

      {/* Main Report */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-slate-500" />
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              {activeTemplate.charAt(0).toUpperCase() + activeTemplate.slice(1)} Report
            </p>
          </div>
          <CopyButton text={content} />
        </div>
        <pre className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
          {content}
        </pre>
      </Card>

      {/* Sections breakdown */}
      <div className="space-y-2">
        <p className="section-label px-1">Report Sections</p>
        <ReportSection title="Headline" content={generatedAnalysis.headline} defaultExpanded />
        <ReportSection title="Summary" content={generatedAnalysis.summary} />
        <ReportSection title="Trend Analysis" content={generatedAnalysis.trendSection} />
        <ReportSection title="Indicators" content={generatedAnalysis.indicatorSection} />
        <ReportSection title="Market Structure" content={generatedAnalysis.marketStructureSection} />
        <ReportSection title="Support & Resistance" content={generatedAnalysis.supportResistanceSection} />
        <ReportSection title="Volume" content={generatedAnalysis.volumeSection} />
        <ReportSection title="Risk" content={generatedAnalysis.riskSection} />
        <ReportSection title="Confidence" content={generatedAnalysis.confidenceSection} />
        {generatedAnalysis.validationSection && (
          <ReportSection title="Validation" content={generatedAnalysis.validationSection} />
        )}
        <ReportSection title="Conclusion" content={generatedAnalysis.conclusion} />
      </div>

      {/* Metadata */}
      <Card className="p-3">
        <p className="section-label mb-2">Writer Metadata</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
          <div><span className="text-slate-500">Template</span><p className="font-mono text-slate-300 mt-0.5">{generatedAnalysis.metadata.template}</p></div>
          <div><span className="text-slate-500">Evidence</span><p className="font-mono text-slate-300 mt-0.5">{generatedAnalysis.metadata.evidenceCount}</p></div>
          <div><span className="text-slate-500">Bull factors</span><p className="font-mono text-emerald-400 mt-0.5">{generatedAnalysis.metadata.bullishFactorCount}</p></div>
          <div><span className="text-slate-500">Bear factors</span><p className="font-mono text-red-400 mt-0.5">{generatedAnalysis.metadata.bearishFactorCount}</p></div>
          <div><span className="text-slate-500">Validation</span><p className={`font-mono mt-0.5 ${generatedAnalysis.metadata.validationPassed ? 'text-emerald-400' : 'text-red-400'}`}>{generatedAnalysis.metadata.validationPassed ? 'passed' : 'failed'}</p></div>
          <div><span className="text-slate-500">Grade</span><p className="font-mono text-slate-300 mt-0.5">{generatedAnalysis.metadata.confidenceGrade}</p></div>
        </div>
      </Card>
    </div>
  )
}
