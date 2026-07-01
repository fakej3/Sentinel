import { CheckCircle, XCircle, AlertTriangle, Info, ShieldCheck } from 'lucide-react'
import { Card } from '../shared/Card'
import { SeverityBadge } from '../shared/Badge'
import { severityBg } from '../../utils/colors'
import type { PipelineResult, ValidationIssue } from '../../types'
import { clsx } from 'clsx'

interface ValidationTabProps {
  result: PipelineResult
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const Icon = issue.severity === 'critical' ? XCircle
    : issue.severity === 'warning' ? AlertTriangle
    : Info

  return (
    <div className={clsx('card p-3 border', severityBg(issue.severity).split(' ').find(c => c.startsWith('border')) ?? 'border-border-subtle')}>
      <div className="flex items-start gap-3">
        <Icon size={14} className={clsx('flex-shrink-0 mt-0.5', {
          'text-red-400': issue.severity === 'critical',
          'text-amber-400': issue.severity === 'warning',
          'text-blue-400': issue.severity === 'info',
        })} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge severity={issue.severity} />
            <span className="text-[10px] text-slate-600 bg-surface-700 px-1.5 py-0.5 rounded">
              {issue.category}
            </span>
            <span className="text-[10px] text-slate-600 font-mono truncate">{issue.field}</span>
          </div>
          <p className="text-xs text-slate-300 leading-snug">{issue.message}</p>
          {(issue.expected !== undefined || issue.actual !== undefined) && (
            <div className="mt-1.5 flex gap-3 text-[11px]">
              {issue.expected !== undefined && (
                <span className="text-slate-500">Expected: <span className="font-mono text-emerald-400">{issue.expected}</span></span>
              )}
              {issue.actual !== undefined && (
                <span className="text-slate-500">Got: <span className="font-mono text-red-400">{issue.actual}</span></span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ValidationTab({ result }: ValidationTabProps) {
  const { validation } = result
  const critical = validation.issues.filter(i => i.severity === 'critical')
  const warnings = validation.issues.filter(i => i.severity === 'warning')
  const infos = validation.issues.filter(i => i.severity === 'info')

  return (
    <div className="p-4 space-y-4 animate-in">
      {/* Health Summary */}
      <Card className={clsx('p-4 border', validation.passed ? 'border-emerald-400/20' : 'border-red-400/20')}>
        <div className="flex items-start gap-4">
          <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', {
            'bg-emerald-400/15': validation.passed && validation.clean,
            'bg-blue-400/15': validation.passed && !validation.clean,
            'bg-red-400/15': !validation.passed,
          })}>
            {validation.passed
              ? <ShieldCheck size={18} className={validation.clean ? 'text-emerald-400' : 'text-blue-400'} />
              : <XCircle size={18} className="text-red-400" />
            }
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-sm font-bold ${validation.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                Validation {validation.passed ? 'Passed' : 'Failed'}
              </h3>
              {validation.clean && (
                <span className="text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-1.5 py-0.5 rounded-full font-medium">
                  Clean
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{validation.summary}</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <div className="text-center">
              <p className={`text-lg font-bold font-mono ${validation.criticalCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                {validation.criticalCount}
              </p>
              <p className="text-[9px] text-slate-600">Critical</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold font-mono ${validation.warningCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                {validation.warningCount}
              </p>
              <p className="text-[9px] text-slate-600">Warnings</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold font-mono ${validation.infoCount > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                {validation.infoCount}
              </p>
              <p className="text-[9px] text-slate-600">Info</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Critical Issues */}
      {critical.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <XCircle size={12} className="text-red-400" />
            <p className="section-label text-red-400">Critical ({critical.length})</p>
          </div>
          {critical.map((issue, i) => <IssueRow key={i} issue={issue} />)}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle size={12} className="text-amber-400" />
            <p className="section-label text-amber-400">Warnings ({warnings.length})</p>
          </div>
          {warnings.map((issue, i) => <IssueRow key={i} issue={issue} />)}
        </div>
      )}

      {/* Info */}
      {infos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Info size={12} className="text-blue-400" />
            <p className="section-label text-blue-400">Info ({infos.length})</p>
          </div>
          {infos.map((issue, i) => <IssueRow key={i} issue={issue} />)}
        </div>
      )}

      {/* Passed checks */}
      {validation.clean && (
        <Card className="p-4 border-emerald-400/10">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">All checks passed — no issues found</p>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 ml-6">
            The analysis output is internally consistent and meets all structural requirements.
          </p>
        </Card>
      )}

      {validation.issues.length === 0 && !validation.clean && (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">No issues logged</p>
          </div>
        </Card>
      )}
    </div>
  )
}
