'use client'

import React from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface QRCodeWrapperProps {
  value: string
  size?: number
}

export default function QRCodeWrapper({ value, size = 128 }: QRCodeWrapperProps) {
  return (
    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm inline-block">
      <QRCodeSVG 
        value={value} 
        size={size} 
        level="H" 
        includeMargin={false}
        className="w-full h-full"
      />
    </div>
  )
}
