import React from 'react'

export function SkeletonCard() {
  return (
    <div className="border border-slate-100 shadow-sm rounded-2xl overflow-hidden bg-white p-5 space-y-4 animate-pulse">
      <div className="flex justify-between items-center pb-4 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-slate-200 rounded-xl" />
          <div className="space-y-2">
            <div className="w-20 h-4 bg-slate-200 rounded" />
            <div className="w-28 h-3 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="w-20 h-5 bg-slate-200 rounded-full" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-200 rounded-full shrink-0" />
          <div className="w-2/3 h-3 bg-slate-200 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-200 rounded-full shrink-0" />
          <div className="w-3/4 h-3 bg-slate-200 rounded" />
        </div>
        <div className="w-1/2 h-3 bg-slate-200 rounded" />
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-slate-50">
        <div className="w-24 h-7 bg-slate-200 rounded-xl" />
        <div className="w-24 h-7 bg-slate-200 rounded-xl" />
      </div>
    </div>
  )
}

interface SkeletonTableProps {
  rows?: number
  cols?: number
}

export function SkeletonTable({ rows = 5, cols = 5 }: SkeletonTableProps) {
  return (
    <div className="w-full border-collapse animate-pulse p-4">
      {/* Header */}
      <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4 flex gap-4 mb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-4 bg-slate-200 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
