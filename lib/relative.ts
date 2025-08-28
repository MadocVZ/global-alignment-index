export function computeRelative(
  value: number,
  cfg: {
    direction: 'up' | 'down'
    reference_min: number
    reference_max: number
    target?: number | null
  }
): number {
  const { direction, reference_min, reference_max, target } = cfg
  const clamp = (n: number) => Math.min(100, Math.max(0, n))
  const span = reference_max - reference_min || 1

  if (direction === 'up') {
    if (target !== undefined && target !== null) {
      const targetSpan = target - reference_min || 1
      if (value >= target) return 100
      return clamp(((value - reference_min) / targetSpan) * 100)
    }
    return clamp(((value - reference_min) / span) * 100)
  } else {
    if (target !== undefined && target !== null) {
      const targetSpan = reference_max - target || 1
      if (value <= target) return 100
      return clamp(((reference_max - value) / targetSpan) * 100)
    }
    return clamp(((reference_max - value) / span) * 100)
  }
}
