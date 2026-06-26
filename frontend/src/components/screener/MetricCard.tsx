interface Props {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  tooltip?: string
}

export default function MetricCard({ label, value, sub, highlight, tooltip }: Props) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${highlight ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}
      title={tooltip}>
      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
        {label}
        {tooltip && (
          <span className="text-gray-400 cursor-help" title={tooltip}>&#9432;</span>
        )}
      </p>
      <p className={`text-lg font-semibold ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
