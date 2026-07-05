interface Props {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  tooltip?: string
}

export default function MetricCard({ label, value, sub, highlight, tooltip }: Props) {
  const borderColor = highlight ? 'rgba(0,212,170,0.25)' : '#1a2d4a'
  const bgColor = highlight ? 'rgba(0,212,170,0.06)' : '#111c2d'
  const valueColor = highlight ? '#00d4aa' : '#c8d8e8'

  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ border: `1px solid ${borderColor}`, background: bgColor }}
      title={tooltip}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: '#4a6080' }}>
        {label}
        {tooltip && (
          <span className="cursor-help" style={{ color: '#3a5070' }} title={tooltip}>&#9432;</span>
        )}
      </p>
      <p className="text-lg font-bold" style={{ color: valueColor }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5" style={{ color: '#3a5870' }}>{sub}</p>}
    </div>
  )
}
