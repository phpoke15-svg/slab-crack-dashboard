"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { GripHorizontal, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  borderBalanceLabel,
  borderThicknesses,
  centeringScoreFromBorders,
  formatCenteringRatio,
  type BorderInsets,
} from "@/lib/grade-estimate"

type CenteringHelperProps = {
  imageUrl: string
  borders: BorderInsets
  onChange: (borders: BorderInsets) => void
  onCenteringScore: (score: number) => void
}

const MIN_ART_SPAN = 22
const MIN_BORDER = 4
const MAX_BORDER = 46

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function pctFromPointer(clientX: number, clientY: number, rect: DOMRect, axis: "x" | "y") {
  if (axis === "x") {
    return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
  }
  return clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)
}

type DragEdge = "top" | "bottom" | "left" | "right"

function MeasurementRow({
  label,
  a,
  b,
  unit,
}: {
  label: string
  a: number
  b: number
  unit: string
}) {
  const larger = Math.max(a, b)
  const smaller = Math.min(a, b)
  const balanced = Math.abs(a - b) < 0.5

  return (
    <div className="rounded-xl border border-border bg-card/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="font-mono text-sm tabular-nums text-foreground">
          {a.toFixed(1)}
          {unit} / {b.toFixed(1)}
          {unit}
        </p>
        <p
          className={cn(
            "font-mono text-xs tabular-nums",
            balanced ? "text-primary" : "text-muted-foreground",
          )}
        >
          {borderBalanceLabel(larger, smaller)}
        </p>
      </div>
    </div>
  )
}

function DraggableGuideLine({
  axis,
  position,
  label,
  onDrag,
}: {
  axis: "horizontal" | "vertical"
  position: number
  label: string
  onDrag: (clientX: number, clientY: number) => void
}) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => onDrag(e.clientX, e.clientY)
    const onUp = () => setDragging(false)

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [dragging, onDrag])

  const isHorizontal = axis === "horizontal"

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(true)
        onDrag(e.clientX, e.clientY)
      }}
      className={cn(
        "absolute z-20 touch-none",
        isHorizontal ? "left-0 right-0 h-4 -translate-y-1/2 cursor-ns-resize" : "top-0 bottom-0 w-4 -translate-x-1/2 cursor-ew-resize",
      )}
      style={isHorizontal ? { top: `${position}%` } : { left: `${position}%` }}
    >
      <span
        className={cn(
          "pointer-events-none absolute bg-primary shadow-[0_0_8px] shadow-primary/50",
          isHorizontal ? "left-0 right-0 top-1/2 h-0.5 -translate-y-1/2" : "bottom-0 top-0 left-1/2 w-0.5 -translate-x-1/2",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute flex items-center justify-center rounded-md border border-primary/50 bg-primary/20 text-primary backdrop-blur-sm",
          isHorizontal ? "left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2" : "left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2",
        )}
      >
        {isHorizontal ? (
          <GripHorizontal className="size-3.5" aria-hidden="true" />
        ) : (
          <GripVertical className="size-3.5" aria-hidden="true" />
        )}
      </span>
    </button>
  )
}

function OuterEdgeLine({ axis, edge }: { axis: "horizontal" | "vertical"; edge: "start" | "end" }) {
  const isHorizontal = axis === "horizontal"
  const atStart = edge === "start"

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-10 bg-foreground/70",
        isHorizontal
          ? cn("left-0 right-0 h-px", atStart ? "top-0" : "bottom-0")
          : cn("bottom-0 top-0 w-px", atStart ? "left-0" : "right-0"),
      )}
    />
  )
}

export function CenteringHelper({
  imageUrl,
  borders,
  onChange,
  onCenteringScore,
}: CenteringHelperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const score = centeringScoreFromBorders(borders)
  const thickness = borderThicknesses(borders)

  const artTop = borders.top
  const artBottom = 100 - borders.bottom
  const artLeft = borders.left
  const artRight = 100 - borders.right

  useEffect(() => {
    onCenteringScore(score)
  }, [score, onCenteringScore])

  const updateFromPointer = useCallback(
    (edge: DragEdge, clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      if (edge === "top") {
        const next = clamp(pctFromPointer(clientX, clientY, rect, "y"), MIN_BORDER, artBottom - MIN_ART_SPAN)
        onChange({ ...borders, top: next })
        return
      }
      if (edge === "bottom") {
        const y = pctFromPointer(clientX, clientY, rect, "y")
        const nextBottom = clamp(100 - y, MIN_BORDER, 100 - artTop - MIN_ART_SPAN)
        onChange({ ...borders, bottom: nextBottom })
        return
      }
      if (edge === "left") {
        const next = clamp(pctFromPointer(clientX, clientY, rect, "x"), MIN_BORDER, artRight - MIN_ART_SPAN)
        onChange({ ...borders, left: next })
        return
      }
      const x = pctFromPointer(clientX, clientY, rect, "x")
      const nextRight = clamp(100 - x, MIN_BORDER, 100 - artLeft - MIN_ART_SPAN)
      onChange({ ...borders, right: nextRight })
    },
    [artBottom, artLeft, artRight, artTop, borders, onChange],
  )

  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Centering guide</h3>
          <p className="text-xs text-muted-foreground">
            Drag the inner lines to the art box edge. Outer lines mark the card border — compare top vs
            bottom and left vs right thickness.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Centering</p>
          <p className="font-mono text-xl font-bold text-primary tabular-nums">{score.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">{formatCenteringRatio(borders)}</p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mx-auto aspect-[3/4] w-full max-w-xs select-none overflow-hidden rounded-xl border-2 border-foreground/30 bg-black/50"
      >
        <Image src={imageUrl} alt="Card front for centering" fill className="object-contain" unoptimized draggable={false} />

        <div className="pointer-events-none absolute inset-0">
          {/* Border zone highlights */}
          <div className="absolute inset-x-0 top-0 bg-primary/15" style={{ height: `${borders.top}%` }} />
          <div className="absolute inset-x-0 bottom-0 bg-primary/15" style={{ height: `${borders.bottom}%` }} />
          <div className="absolute bottom-0 left-0 top-0 bg-sky-400/15" style={{ width: `${borders.left}%` }} />
          <div className="absolute bottom-0 right-0 top-0 bg-sky-400/15" style={{ width: `${borders.right}%` }} />

          {/* Art box */}
          <div
            className="absolute border border-dashed border-primary/60"
            style={{
              top: `${borders.top}%`,
              right: `${borders.right}%`,
              bottom: `${borders.bottom}%`,
              left: `${borders.left}%`,
            }}
          />
        </div>

        {/* Outer card edges */}
        <OuterEdgeLine axis="horizontal" edge="start" />
        <OuterEdgeLine axis="horizontal" edge="end" />
        <OuterEdgeLine axis="vertical" edge="start" />
        <OuterEdgeLine axis="vertical" edge="end" />

        {/* Inner art edges — draggable */}
        <DraggableGuideLine
          axis="horizontal"
          position={artTop}
          label="Drag top art edge"
          onDrag={(x, y) => updateFromPointer("top", x, y)}
        />
        <DraggableGuideLine
          axis="horizontal"
          position={artBottom}
          label="Drag bottom art edge"
          onDrag={(x, y) => updateFromPointer("bottom", x, y)}
        />
        <DraggableGuideLine
          axis="vertical"
          position={artLeft}
          label="Drag left art edge"
          onDrag={(x, y) => updateFromPointer("left", x, y)}
        />
        <DraggableGuideLine
          axis="vertical"
          position={artRight}
          label="Drag right art edge"
          onDrag={(x, y) => updateFromPointer("right", x, y)}
        />

        {/* Thickness labels on each border */}
        <span
          className="pointer-events-none absolute left-1/2 z-10 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[9px] text-primary tabular-nums"
          style={{ top: `${borders.top / 2}%`, transform: "translate(-50%, -50%)" }}
        >
          {thickness.top.toFixed(1)}%
        </span>
        <span
          className="pointer-events-none absolute left-1/2 z-10 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[9px] text-primary tabular-nums"
          style={{ top: `${100 - borders.bottom / 2}%`, transform: "translate(-50%, -50%)" }}
        >
          {thickness.bottom.toFixed(1)}%
        </span>
        <span
          className="pointer-events-none absolute top-1/2 z-10 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[9px] text-sky-300 tabular-nums"
          style={{ left: `${borders.left / 2}%`, transform: "translate(-50%, -50%)" }}
        >
          {thickness.left.toFixed(1)}%
        </span>
        <span
          className="pointer-events-none absolute top-1/2 z-10 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[9px] text-sky-300 tabular-nums"
          style={{ left: `${100 - borders.right / 2}%`, transform: "translate(-50%, -50%)" }}
        >
          {thickness.right.toFixed(1)}%
        </span>
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Solid outer lines = card edge · Draggable inner lines = art box edge
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <MeasurementRow label="Top vs bottom" a={thickness.top} b={thickness.bottom} unit="%" />
        <MeasurementRow label="Left vs right" a={thickness.left} b={thickness.right} unit="%" />
      </div>
    </div>
  )
}
