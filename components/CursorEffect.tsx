"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname } from "next/navigation"

interface TrailParticle {
  id: number
  x: number
  y: number
  opacity: number
}

export default function CursorEffect() {
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 })
  const [particles, setParticles] = useState<TrailParticle[]>([])
  const [enabled, setEnabled] = useState(true)
  const pathname = usePathname()

  const particleIdRef = useRef(0)

  useEffect(() => {
    const isMeasurePage = pathname === "/measure"
    const coarsePointer =
      typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches
    setEnabled(!isMeasurePage && !coarsePointer)
  }, [pathname])

  useEffect(() => {
    if (!enabled) return

    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY })

      if (Math.random() < 0.15) {
        const offsetX = (Math.random() - 0.5) * 30
        const offsetY = (Math.random() - 0.5) * 30
        setParticles(prev => [
          ...prev,
          { id: particleIdRef.current++, x: e.clientX + offsetX, y: e.clientY + offsetY, opacity: 0.8 }
        ])
      }
    }

    window.addEventListener("mousemove", handleMouseMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({ ...p, opacity: p.opacity - 0.05 }))
          .filter((p) => p.opacity > 0)
      )
    }, 50)
    return () => clearInterval(interval)
  }, [enabled])

  if (!enabled) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-9999 overflow-hidden">
      {/* Custom Paddy Cursor */}
      <img 
        src="/paddy.png" 
        alt="cursor"
        className="fixed w-8 h-8 object-contain drop-shadow-md"
        style={{
          left: cursorPos.x,
          top: cursorPos.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 10000
        }}
      />
      {/* Light Golden Rice Scatter Trail */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="fixed pointer-events-none text-[10px] sm:text-lg drop-shadow-[0_0_5px_rgba(255,215,0,0.6)]"
          style={{
            left: p.x,
            top: p.y,
            opacity: p.opacity,
            transform: `translate(-50%, -50%) scale(${0.5 + p.opacity * 0.5}) rotate(${p.id * 30}deg)`,
            transition: "opacity 50ms linear, transform 50ms linear",
            zIndex: 9999
          }}
        >
          🌾
        </div>
      ))}
    </div>
  )
}
