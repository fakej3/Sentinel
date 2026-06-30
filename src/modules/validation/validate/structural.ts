import type { MarketAnalysisResult } from '../../analysis/types'
import type { PriceZone } from '../../support-resistance/types'
import type { ValidationIssue, ValidationConfig } from '../types'

function critical(field: string, message: string, expected?: string, actual?: string): ValidationIssue {
  return { severity: 'critical', category: 'structural', field, message, expected, actual }
}

function warning(field: string, message: string, expected?: string, actual?: string): ValidationIssue {
  return { severity: 'warning', category: 'structural', field, message, expected, actual }
}

export function checkStructural(
  result: MarketAnalysisResult,
  cfg: ValidationConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { marketStructure, supportResistance } = result

  // ── Zone geometry ─────────────────────────────────────────────────────────

  for (const zone of supportResistance.zones) {
    const id = zone.id

    if (zone.lower > zone.center) {
      const relErr = zone.center > 0 ? (zone.lower - zone.center) / zone.center : 1
      if (relErr > cfg.zoneCenterTolerance) {
        issues.push(critical(
          `supportResistance.zones[${id}].lower`,
          `Zone ${id}: lower (${zone.lower}) > center (${zone.center})`,
          'lower <= center', `lower=${zone.lower}, center=${zone.center}`,
        ))
      }
    }

    if (zone.center > zone.upper) {
      const relErr = zone.upper > 0 ? (zone.center - zone.upper) / zone.upper : 1
      if (relErr > cfg.zoneCenterTolerance) {
        issues.push(critical(
          `supportResistance.zones[${id}].center`,
          `Zone ${id}: center (${zone.center}) > upper (${zone.upper})`,
          'center <= upper', `center=${zone.center}, upper=${zone.upper}`,
        ))
      }
    }

    if (zone.lower >= zone.upper) {
      issues.push(critical(
        `supportResistance.zones[${id}]`,
        `Zone ${id}: lower (${zone.lower}) >= upper (${zone.upper}) — zone has no width`,
        'lower < upper', `lower=${zone.lower}, upper=${zone.upper}`,
      ))
    }

    const expectedWidth = zone.upper - zone.lower
    if (Math.abs(zone.width - expectedWidth) > 0.0001) {
      issues.push(warning(
        `supportResistance.zones[${id}].width`,
        `Zone ${id}: width (${zone.width}) does not equal upper − lower (${expectedWidth})`,
        String(expectedWidth), String(zone.width),
      ))
    }
  }

  // ── activeSupport must contain only non-broken support zones ─────────────

  for (let i = 0; i < supportResistance.activeSupport.length; i++) {
    const zone: PriceZone = supportResistance.activeSupport[i]
    if (zone.type !== 'support') {
      issues.push(critical(
        `supportResistance.activeSupport[${i}]`,
        `activeSupport[${i}] (${zone.id}) has type '${zone.type}'; only support zones belong here`,
        'type === support', `type=${zone.type}`,
      ))
    }
    if (zone.broken) {
      issues.push(critical(
        `supportResistance.activeSupport[${i}]`,
        `activeSupport[${i}] (${zone.id}) is broken; broken zones must not appear in activeSupport`,
        'broken === false', 'broken === true',
      ))
    }
  }

  // ── activeResistance must contain only non-broken resistance zones ────────

  for (let i = 0; i < supportResistance.activeResistance.length; i++) {
    const zone: PriceZone = supportResistance.activeResistance[i]
    if (zone.type !== 'resistance') {
      issues.push(critical(
        `supportResistance.activeResistance[${i}]`,
        `activeResistance[${i}] (${zone.id}) has type '${zone.type}'; only resistance zones belong here`,
        'type === resistance', `type=${zone.type}`,
      ))
    }
    if (zone.broken) {
      issues.push(critical(
        `supportResistance.activeResistance[${i}]`,
        `activeResistance[${i}] (${zone.id}) is broken; broken zones must not appear in activeResistance`,
        'broken === false', 'broken === true',
      ))
    }
  }

  // ── BOS detected flag must match events array ─────────────────────────────

  const bosHasEvents = marketStructure.bos.events.length > 0
  if (marketStructure.bos.detected !== bosHasEvents) {
    issues.push(critical(
      'marketStructure.bos.detected',
      `bos.detected is ${marketStructure.bos.detected} but bos.events has ${marketStructure.bos.events.length} item(s)`,
      String(bosHasEvents), String(marketStructure.bos.detected),
    ))
  }

  // ── BOS last must be the final event in events array ─────────────────────

  if (marketStructure.bos.detected) {
    const bosEvents = marketStructure.bos.events
    const expectedLast = bosEvents[bosEvents.length - 1]
    if (marketStructure.bos.last !== expectedLast) {
      issues.push(critical(
        'marketStructure.bos.last',
        `bos.last does not match the final element of bos.events`,
        `events[${bosEvents.length - 1}]`, 'different object',
      ))
    }
  } else if (marketStructure.bos.last !== null) {
    issues.push(critical(
      'marketStructure.bos.last',
      'bos.last is non-null but bos.detected is false',
      'null', 'non-null event',
    ))
  }

  // ── CHOCH detected flag must match events array ───────────────────────────

  const chochHasEvents = marketStructure.choch.events.length > 0
  if (marketStructure.choch.detected !== chochHasEvents) {
    issues.push(critical(
      'marketStructure.choch.detected',
      `choch.detected is ${marketStructure.choch.detected} but choch.events has ${marketStructure.choch.events.length} item(s)`,
      String(chochHasEvents), String(marketStructure.choch.detected),
    ))
  }

  // ── CHOCH last must be the final event in events array ───────────────────

  if (marketStructure.choch.detected) {
    const chochEvents = marketStructure.choch.events
    const expectedLast = chochEvents[chochEvents.length - 1]
    if (marketStructure.choch.last !== expectedLast) {
      issues.push(critical(
        'marketStructure.choch.last',
        `choch.last does not match the final element of choch.events`,
        `events[${chochEvents.length - 1}]`, 'different object',
      ))
    }
  } else if (marketStructure.choch.last !== null) {
    issues.push(critical(
      'marketStructure.choch.last',
      'choch.last is non-null but choch.detected is false',
      'null', 'non-null event',
    ))
  }

  // ── BOS events must be chronologically ordered ────────────────────────────

  for (let i = 1; i < marketStructure.bos.events.length; i++) {
    if (marketStructure.bos.events[i].index < marketStructure.bos.events[i - 1].index) {
      issues.push(critical(
        `marketStructure.bos.events[${i}]`,
        `BOS events are not chronologically ordered: index ${marketStructure.bos.events[i].index} < ${marketStructure.bos.events[i - 1].index}`,
        'ascending index', 'non-ascending',
      ))
      break
    }
  }

  // ── CHOCH events must be chronologically ordered ──────────────────────────

  for (let i = 1; i < marketStructure.choch.events.length; i++) {
    if (marketStructure.choch.events[i].index < marketStructure.choch.events[i - 1].index) {
      issues.push(critical(
        `marketStructure.choch.events[${i}]`,
        `CHOCH events are not chronologically ordered: index ${marketStructure.choch.events[i].index} < ${marketStructure.choch.events[i - 1].index}`,
        'ascending index', 'non-ascending',
      ))
      break
    }
  }

  // ── events array must contain all BOS + CHOCH events ─────────────────────

  const expectedEventCount = marketStructure.bos.events.length + marketStructure.choch.events.length
  if (marketStructure.events.length !== expectedEventCount) {
    issues.push(critical(
      'marketStructure.events',
      `events has ${marketStructure.events.length} item(s) but bos.events (${marketStructure.bos.events.length}) + choch.events (${marketStructure.choch.events.length}) = ${expectedEventCount}`,
      String(expectedEventCount), String(marketStructure.events.length),
    ))
  }

  // ── events must be chronologically ordered ────────────────────────────────

  for (let i = 1; i < marketStructure.events.length; i++) {
    if (marketStructure.events[i].index < marketStructure.events[i - 1].index) {
      issues.push(critical(
        `marketStructure.events[${i}]`,
        `marketStructure.events is not chronologically ordered: index ${marketStructure.events[i].index} < ${marketStructure.events[i - 1].index}`,
        'ascending index', 'non-ascending',
      ))
      break
    }
  }

  return issues
}
