/*!
 * Ecctrl
 * https://github.com/pmndrs/ecctrl
 *
 * SPDX-FileCopyrightText: 2023-2026 Erdong Chen
 * SPDX-License-Identifier: MIT
 */

import { createPlugin, useInputContext, Components, useCanvas2d, useInputSetters, type LevaInputProps } from 'leva/plugin'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { bakeCurveLUT, evaluateCurveLUT, type CurvePoint } from '../../curves/CurveLUT'
import * as COLOR from '../../shared/constants/Color'

const TOTAL_GRIDS = 12;
const INNER_GRIDS = 10;
const MARGIN_GRIDS = 1;

// Canvas layout and interaction tuning values.
const DEFAULT_SAMPLES = 50
const DEFAULT_POINTS: CurvePoint[] = [{ x: 0, y: 0, r_out: 0 }, { x: 1, y: 1, r_in: 0 },]
const POINT_RADIUS = 6
const ACTIVE_POINT_RADIUS = 8
const POINT_HIT_RADIUS = 14
const TANGENT_LEN = 0.18
const TANGENT_HANDLE_RADIUS = 5
const ACTIVE_TANGENT_HANDLE_RADIUS = 7
const TANGENT_HIT_RADIUS = 12
const CURVE_X_EPSILON = 1e-4

const { Label, Row, Number: LevaNumber } = Components
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const getCurvePointValue = (value: LevaNum | undefined) => typeof value === 'object' && value !== null ? value.value : value
const isSameTangentHandle = (a: TangentHandleTarget | null, b: TangentHandleTarget | null) => a?.pointIndex === b?.pointIndex && a?.type === b?.type

/**
 * Generate single Leva number input with unique id
 */
const CurveNumberInput = ({ id, label, value, settings, innerLabelTrim, onUpdate }: {
    id: string
    label: string
    value: number
    settings: CurveNumberSettings
    innerLabelTrim: number
    onUpdate: (value: number) => void
}) => {
    const valueRef = useRef(value)
    valueRef.current = value

    // Handle direct input and draggable label value update
    const setValue = useCallback((nextValue: any) => {
        const resolvedValue = typeof nextValue === 'function' ? nextValue(valueRef.current) : nextValue
        const value = globalThis.Number.isFinite(resolvedValue) ? resolvedValue : valueRef.current
        onUpdate(clamp(value, settings.min, settings.max))
    }, [onUpdate, settings.max, settings.min])

    const number = useInputSetters({ type: 'NUMBER', value, settings, setValue })

    return (
        <LevaNumber
            id={id}
            label={label}
            value={value}
            displayValue={number.displayValue}
            onUpdate={number.onUpdate}
            onChange={number.onChange}
            settings={settings}
            innerLabelTrim={innerLabelTrim}
        />
    )
}

/**
 * Generate Leva number inputs row without sharing parent id
 */
const CurveVectorInput = ({ id, value, settings, innerLabelTrim, onUpdate }: {
    id: string
    value: Record<string, number>
    settings: Record<string, CurveNumberSettings>
    innerLabelTrim: number
    onUpdate: (value: Record<string, number>) => void
}) => (
    <div style={{ display: 'grid', gridAutoFlow: 'column dense', alignItems: 'center', columnGap: 7 }}>
        {Object.keys(value).map((key) => (
            <CurveNumberInput
                key={key}
                id={`${id}.${key}`}
                label={key}
                value={value[key]}
                settings={settings[key]}
                innerLabelTrim={innerLabelTrim}
                onUpdate={(nextValue) => onUpdate({ [key]: nextValue })}
            />
        ))}
    </div>
)

// Placeholder field keeps endpoint rows aligned without exposing invalid controls.
const CurveDisabledField = ({ label }: { label: string }) => (
    <div
        style={{
            alignItems: 'center',
            background: '#373c4b',
            borderRadius: 3,
            boxSizing: 'border-box',
            color: 'inherit',
            display: 'grid',
            fontSize: '0.8em',
            gridTemplateColumns: 'auto 1fr',
            height: 24,
            minWidth: 0,
            overflow: 'hidden',
            padding: '0 6px',
            pointerEvents: 'none',
            textTransform: 'uppercase',
            width: '100%',
        }}
    >
        <span style={{ opacity: 0.3 }}>{label}</span>
        <span style={{ opacity: 0.25, textAlign: 'right' }}>--</span>
    </div>
)

// Keep endpoint-only tangent controls aligned with Leva's two-column Vector layout.
const CurvePairInput = ({ left, right }: {
    left?: React.ReactNode
    right?: React.ReactNode
}) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', columnGap: 7, width: '100%' }}>
        <div style={{ minWidth: 0 }}>{left}</div>
        <div style={{ minWidth: 0 }}>{right}</div>
    </div>
)

const CurveEditorCanvasComponent = () => {
    // Access Leva input context
    const { id, label, value, settings, onUpdate } = useInputContext<LevaInputProps<CurveValue, CurveSettings>>()
    const { points, samples } = value
    // Interaction state lives in refs so hover redraws do not re-render the Leva control tree.
    const hoveredPointIndex = useRef<number | null>(null)
    const draggingPointIndex = useRef<number | null>(null)
    const hoveredTangentHandle = useRef<TangentHandleTarget | null>(null)
    const draggingTangentHandle = useRef<TangentHandleTarget | null>(null)

    // Bake once per edit; runtime physics only reads the LUT.
    const curveLUT = useMemo(() => bakeCurveLUT(points, samples), [points, samples])

    /**
     * Generate centered square region for graph
     */
    const createViewport = useCallback((canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        // Size of a single virtual grid cell
        const gridSizeX = rect.width / TOTAL_GRIDS;
        const gridSizeY = rect.height / TOTAL_GRIDS;
        // Maximum drawable region inside the inner grid area
        const maxGraphWidth = INNER_GRIDS * gridSizeX;
        const maxGraphHeight = INNER_GRIDS * gridSizeY;
        // Force the graph to be square
        const graphSize = Math.min(maxGraphWidth, maxGraphHeight);
        // Center the square graph inside the inner region
        const graphLeft = MARGIN_GRIDS * gridSizeX + (maxGraphWidth - graphSize) * 0.5;
        const graphTop = MARGIN_GRIDS * gridSizeY + (maxGraphHeight - graphSize) * 0.5;
        const graphWidth = graphSize;
        const graphHeight = graphSize;

        return { gridSizeX, gridSizeY, graphLeft, graphTop, graphWidth, graphHeight };
    }, [TOTAL_GRIDS, INNER_GRIDS, MARGIN_GRIDS])

    /**
     * Generate overall hermite graph within canvas
     */
    const drawCurve = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Handle high screen dpr
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = rect.width * dpr;
        const displayHeight = rect.height * dpr;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear canvas
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Create viewport
        const viewport = createViewport(canvas);
        const toX = (x: number) => viewport.graphLeft + x * viewport.graphWidth
        const toY = (y: number) => viewport.graphTop + (1 - y) * viewport.graphHeight

        /**
         * Draw grid
         */
        ctx.strokeStyle = COLOR.EC_MED_GRAY;
        ctx.lineWidth = 1;
        for (let i = 0; i <= TOTAL_GRIDS; i++) {
            const x = i * viewport.gridSizeX;
            const y = i * viewport.gridSizeY;
            // Vertical
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, rect.height);
            ctx.stroke();
            // Horizontal
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(rect.width, y);
            ctx.stroke();
        }

        // Graph border
        ctx.strokeStyle = COLOR.EC_GRAY;
        ctx.lineWidth = 2;
        ctx.strokeRect(viewport.graphLeft, viewport.graphTop, viewport.graphWidth, viewport.graphHeight);

        /**
         * Draw axis labels
         */
        ctx.fillStyle = COLOR.EC_AZURE;
        ctx.textAlign = "center";
        // X-axis: 0, 0.5, 1
        [0, 0.5, 1].forEach((v) => {
            const px = toX(v);
            const py = viewport.graphTop + viewport.graphHeight + 14;
            ctx.fillText(v.toString(), px, py);
        });
        // Y-axis: 0, 0.5, 1
        ctx.textAlign = "right";
        [0, 0.5, 1].forEach((v) => {
            const px = viewport.graphLeft - 7;
            const py = toY(v);
            ctx.fillText(v.toString(), px, py);
        });

        /**
         * Draw Hermite curve
         */
        ctx.strokeStyle = COLOR.EC_AZURE
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let s = 0; s <= samples; s++) {
            const x = s / samples;
            const y = evaluateCurveLUT(x, curveLUT);
            const px = toX(x)
            const py = toY(y)
            if (s === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
        }
        ctx.stroke()

        /**
         * Draw tangent lines
         */
        points.forEach((p, i) => {
            const px = toX(p.x);
            const py = toY(p.y);
            // Out tangent (to the right)
            if (p.r_out !== undefined) {
                const dx = Math.cos(p.r_out) * TANGENT_LEN * (p.w_out ?? 1);
                const dy = Math.sin(p.r_out) * TANGENT_LEN * (p.w_out ?? 1);
                const hx = toX(p.x + dx)
                const hy = toY(p.y + dy)
                const isActive = isSameTangentHandle(hoveredTangentHandle.current, { pointIndex: i, type: 'out' })
                    || isSameTangentHandle(draggingTangentHandle.current, { pointIndex: i, type: 'out' })
                ctx.strokeStyle = isActive ? COLOR.EC_AZURE : COLOR.EC_CORNFLOWER_BLUE
                ctx.lineWidth = isActive ? 3 : 2
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(hx, hy);
                ctx.stroke();
                ctx.fillStyle = isActive ? COLOR.EC_AZURE : COLOR.EC_CORNFLOWER_BLUE
                ctx.beginPath();
                ctx.arc(hx, hy, isActive ? ACTIVE_TANGENT_HANDLE_RADIUS : TANGENT_HANDLE_RADIUS, 0, Math.PI * 2);
                ctx.fill();
            }
            // In tangent (to the left)
            if (p.r_in !== undefined) {
                const dx = Math.cos(p.r_in) * TANGENT_LEN * (p.w_in ?? 1);
                const dy = Math.sin(p.r_in) * TANGENT_LEN * (p.w_in ?? 1);
                const hx = toX(p.x - dx)
                const hy = toY(p.y - dy)
                const isActive = isSameTangentHandle(hoveredTangentHandle.current, { pointIndex: i, type: 'in' })
                    || isSameTangentHandle(draggingTangentHandle.current, { pointIndex: i, type: 'in' })
                ctx.strokeStyle = isActive ? COLOR.EC_AZURE : COLOR.EC_CORNFLOWER_BLUE
                ctx.lineWidth = isActive ? 3 : 2
                ctx.beginPath();
                ctx.moveTo(hx, hy);
                ctx.lineTo(px, py);
                ctx.stroke();
                ctx.fillStyle = isActive ? COLOR.EC_AZURE : COLOR.EC_CORNFLOWER_BLUE
                ctx.beginPath();
                ctx.arc(hx, hy, isActive ? ACTIVE_TANGENT_HANDLE_RADIUS : TANGENT_HANDLE_RADIUS, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        /**
         * Draw points
         */
        points.forEach((p, i) => {
            const px = toX(p.x);
            const py = toY(p.y);
            const isActive = hoveredPointIndex.current === i || draggingPointIndex.current === i
            ctx.fillStyle = isActive ? COLOR.EC_AZURE : COLOR.EC_RED
            ctx.beginPath();
            ctx.arc(px, py, isActive ? ACTIVE_POINT_RADIUS : POINT_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            if (isActive) {
                ctx.strokeStyle = COLOR.EC_RED
                ctx.lineWidth = 2
                ctx.stroke()
            }

            ctx.fillStyle = isActive ? COLOR.EC_AZURE : COLOR.EC_RED
            ctx.textAlign = "left"
            ctx.textBaseline = "bottom"
            ctx.fillText(`P${i}`, px + 8, py - 6)
        })
    }, [points, samples, curveLUT])

    const [canvasRef] = useCanvas2d(() => { drawCurve() })

    useEffect(() => { drawCurve() }, [drawCurve])

    // Convert pointer position from canvas pixels into normalized curve coordinates.
    const getPointerInfo = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return null

        const rect = canvas.getBoundingClientRect()
        const viewport = createViewport(canvas)
        const canvasX = event.clientX - rect.left
        const canvasY = event.clientY - rect.top
        const x = clamp((canvasX - viewport.graphLeft) / viewport.graphWidth, 0, 1)
        const y = clamp(1 - (canvasY - viewport.graphTop) / viewport.graphHeight, 0, 1)

        return { x, y, canvasX, canvasY, viewport }
    }, [canvasRef, createViewport])

    // Hit test visible control points using screen-space radius for easier dragging.
    const findPointIndex = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const pointerInfo = getPointerInfo(event)
        if (!pointerInfo) return null

        let closestIndex: number | null = null
        let closestDistanceSq = POINT_HIT_RADIUS * POINT_HIT_RADIUS

        points.forEach((point, index) => {
            const px = pointerInfo.viewport.graphLeft + point.x * pointerInfo.viewport.graphWidth
            const py = pointerInfo.viewport.graphTop + (1 - point.y) * pointerInfo.viewport.graphHeight
            const dx = pointerInfo.canvasX - px
            const dy = pointerInfo.canvasY - py
            const distanceSq = dx * dx + dy * dy
            if (distanceSq <= closestDistanceSq) {
                closestDistanceSq = distanceSq
                closestIndex = index
            }
        })

        return closestIndex
    }, [getPointerInfo, points])

    // Hit test tangent handles separately so handles take priority over nearby points.
    const findTangentHandle = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const pointerInfo = getPointerInfo(event)
        if (!pointerInfo) return null

        let closestHandle: TangentHandleTarget | null = null
        let closestDistanceSq = TANGENT_HIT_RADIUS * TANGENT_HIT_RADIUS

        points.forEach((point, pointIndex) => {
            if (point.r_out !== undefined) {
                const handleX = point.x + Math.cos(point.r_out) * TANGENT_LEN * (point.w_out ?? 1)
                const handleY = point.y + Math.sin(point.r_out) * TANGENT_LEN * (point.w_out ?? 1)
                const px = pointerInfo.viewport.graphLeft + handleX * pointerInfo.viewport.graphWidth
                const py = pointerInfo.viewport.graphTop + (1 - handleY) * pointerInfo.viewport.graphHeight
                const dx = pointerInfo.canvasX - px
                const dy = pointerInfo.canvasY - py
                const distanceSq = dx * dx + dy * dy
                if (distanceSq <= closestDistanceSq) {
                    closestDistanceSq = distanceSq
                    closestHandle = { pointIndex, type: 'out' }
                }
            }

            if (point.r_in !== undefined) {
                const handleX = point.x - Math.cos(point.r_in) * TANGENT_LEN * (point.w_in ?? 1)
                const handleY = point.y - Math.sin(point.r_in) * TANGENT_LEN * (point.w_in ?? 1)
                const px = pointerInfo.viewport.graphLeft + handleX * pointerInfo.viewport.graphWidth
                const py = pointerInfo.viewport.graphTop + (1 - handleY) * pointerInfo.viewport.graphHeight
                const dx = pointerInfo.canvasX - px
                const dy = pointerInfo.canvasY - py
                const distanceSq = dx * dx + dy * dy
                if (distanceSq <= closestDistanceSq) {
                    closestDistanceSq = distanceSq
                    closestHandle = { pointIndex, type: 'in' }
                }
            }
        })

        return closestHandle
    }, [getPointerInfo, points])

    // Dragging points updates only x/y and preserves tangent values.
    const updateDraggedPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const pointIndex = draggingPointIndex.current
        if (pointIndex === null) return

        const pointerInfo = getPointerInfo(event)
        if (!pointerInfo) return

        const pointSettings = settings.points[pointIndex]
        // Keep points sorted by x so every curve segment remains valid.
        const minX = pointIndex > 0 ? points[pointIndex - 1].x + CURVE_X_EPSILON : pointSettings.x.min
        const maxX = pointIndex < points.length - 1 ? points[pointIndex + 1].x - CURVE_X_EPSILON : pointSettings.x.max
        const nextX = clamp(pointerInfo.x, minX, maxX)
        const nextY = clamp(pointerInfo.y, pointSettings.y.min, pointSettings.y.max)

        const nextPoints = [...points]
        nextPoints[pointIndex] = {
            ...nextPoints[pointIndex],
            x: nextX,
            y: nextY,
        }
        onUpdate({ ...value, points: nextPoints })
    }, [getPointerInfo, onUpdate, points, settings.points, value])

    // Dragging tangent handles writes back both angle and weight.
    const updateDraggedTangentHandle = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const tangentHandle = draggingTangentHandle.current
        if (!tangentHandle) return

        const pointerInfo = getPointerInfo(event)
        if (!pointerInfo) return

        const point = points[tangentHandle.pointIndex]
        const pointSettings = settings.points[tangentHandle.pointIndex]
        const dx = tangentHandle.type === 'out' ? pointerInfo.x - point.x : point.x - pointerInfo.x
        const dy = tangentHandle.type === 'out' ? pointerInfo.y - point.y : point.y - pointerInfo.y
        // Dragged handle position maps back to tangent angle and weight.
        const angle = Math.atan2(dy, dx)
        const weight = Math.sqrt(dx * dx + dy * dy) / TANGENT_LEN

        const nextPoints = [...points]
        if (tangentHandle.type === 'out') {
            nextPoints[tangentHandle.pointIndex] = {
                ...nextPoints[tangentHandle.pointIndex],
                r_out: clamp(angle, pointSettings.r_out.min, pointSettings.r_out.max),
                w_out: clamp(weight, pointSettings.w_out.min, pointSettings.w_out.max),
            }
        } else {
            nextPoints[tangentHandle.pointIndex] = {
                ...nextPoints[tangentHandle.pointIndex],
                r_in: clamp(angle, pointSettings.r_in.min, pointSettings.r_in.max),
                w_in: clamp(weight, pointSettings.w_in.min, pointSettings.w_in.max),
            }
        }
        onUpdate({ ...value, points: nextPoints })
    }, [getPointerInfo, onUpdate, points, settings.points, value])

    // Pointer handlers only mutate refs while hovering; Leva state changes happen during drags.
    const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const tangentHandle = findTangentHandle(event)
        if (tangentHandle) {
            hoveredPointIndex.current = null
            hoveredTangentHandle.current = tangentHandle
            draggingTangentHandle.current = tangentHandle
            event.currentTarget.style.cursor = 'grabbing'
            event.currentTarget.setPointerCapture(event.pointerId)
            drawCurve()
            event.preventDefault()
            return
        }

        const pointIndex = findPointIndex(event)
        if (pointIndex === null) return

        hoveredPointIndex.current = pointIndex
        hoveredTangentHandle.current = null
        draggingPointIndex.current = pointIndex
        event.currentTarget.style.cursor = 'grabbing'
        event.currentTarget.setPointerCapture(event.pointerId)
        drawCurve()
        event.preventDefault()
    }, [drawCurve, findPointIndex, findTangentHandle])

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (draggingTangentHandle.current !== null) {
            event.currentTarget.style.cursor = 'grabbing'
            updateDraggedTangentHandle(event)
            event.preventDefault()
            return
        }

        if (draggingPointIndex.current !== null) {
            event.currentTarget.style.cursor = 'grabbing'
            updateDraggedPoint(event)
            event.preventDefault()
            return
        }

        const tangentHandle = findTangentHandle(event)
        if (tangentHandle) {
            event.currentTarget.style.cursor = 'grab'
            if (!isSameTangentHandle(hoveredTangentHandle.current, tangentHandle) || hoveredPointIndex.current !== null) {
                hoveredTangentHandle.current = tangentHandle
                hoveredPointIndex.current = null
                drawCurve()
            }
            return
        }

        const pointIndex = findPointIndex(event)
        event.currentTarget.style.cursor = pointIndex === null ? 'default' : 'grab'

        if (hoveredPointIndex.current !== pointIndex || hoveredTangentHandle.current !== null) {
            hoveredPointIndex.current = pointIndex
            hoveredTangentHandle.current = null
            drawCurve()
        }
    }, [drawCurve, findPointIndex, findTangentHandle, updateDraggedPoint, updateDraggedTangentHandle])

    const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (draggingPointIndex.current === null && draggingTangentHandle.current === null) return
        draggingPointIndex.current = null
        draggingTangentHandle.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        const tangentHandle = findTangentHandle(event)
        const pointIndex = tangentHandle ? null : findPointIndex(event)
        hoveredTangentHandle.current = tangentHandle
        hoveredPointIndex.current = pointIndex
        event.currentTarget.style.cursor = tangentHandle || pointIndex !== null ? 'grab' : 'default'
        drawCurve()
        event.preventDefault()
    }, [drawCurve, findPointIndex, findTangentHandle])

    const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (draggingPointIndex.current !== null || draggingTangentHandle.current !== null) return
        if (hoveredPointIndex.current === null && hoveredTangentHandle.current === null) return

        hoveredPointIndex.current = null
        hoveredTangentHandle.current = null
        event.currentTarget.style.cursor = 'default'
        drawCurve()
    }, [drawCurve])

    return (
        <>
            <Row>
                <Label>{label}</Label>
                <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: '250px', touchAction: 'none' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={handlePointerLeave}
                />
            </Row>
            <br />
            {/* Numeric controls mirror the canvas state for precise editing. */}
            <Row input>
                <Label>Smaples</Label>
                <CurveVectorInput
                    id={id}
                    value={{ samples: samples }}
                    settings={{ samples: { ...settings.samples, pad: 0 } }}
                    innerLabelTrim={10}
                    onUpdate={(v: any) => onUpdate({ ...value, samples: v.samples })}
                />
            </Row>
            <br />
            {points.map((p, i) => (
                <React.Fragment key={i}>
                    {(() => {
                        // Endpoints only use tangents that point into a segment
                        const canUseIn = i > 0
                        const canUseOut = i < points.length - 1

                        return (
                            <>
                                <Row input>
                                    <Label>P{i} pos</Label>
                                    <CurveVectorInput
                                        id={`${id}.p${i}.pos`}
                                        value={{ x: p.x, y: p.y }}
                                        settings={{ x: { ...settings.points[i].x, pad: 2 }, y: { ...settings.points[i].y, pad: 2 } }}
                                        innerLabelTrim={4}
                                        onUpdate={(v: any) => {
                                            const newPoints = [...points];
                                            newPoints[i] = { ...newPoints[i], ...v };
                                            onUpdate({ ...value, points: newPoints });
                                        }}
                                    />
                                </Row>
                                <Row input>
                                    <Label>P{i} angle</Label>
                                    <CurvePairInput
                                        left={canUseIn ? (
                                            <CurveNumberInput
                                                id={`${id}.p${i}.r_in`}
                                                label="r_in"
                                                value={p.r_in ?? 0}
                                                settings={{ ...settings.points[i].r_in, pad: 2 }}
                                                innerLabelTrim={4}
                                                onUpdate={(r_in) => {
                                                    const newPoints = [...points];
                                                    const updatedPoint: CurvePoint = { ...newPoints[i], r_in };
                                                    if (p.r_in === undefined && r_in === 0) delete updatedPoint.r_in;
                                                    newPoints[i] = updatedPoint;
                                                    onUpdate({ ...value, points: newPoints });
                                                }}
                                            />
                                        ) : (
                                            <CurveDisabledField label="R_IN" />
                                        )}
                                        right={canUseOut ? (
                                            <CurveNumberInput
                                                id={`${id}.p${i}.r_out`}
                                                label="r_out"
                                                value={p.r_out ?? 0}
                                                settings={{ ...settings.points[i].r_out, pad: 2 }}
                                                innerLabelTrim={4}
                                                onUpdate={(r_out) => {
                                                    const newPoints = [...points];
                                                    const updatedPoint: CurvePoint = { ...newPoints[i], r_out };
                                                    if (p.r_out === undefined && r_out === 0) delete updatedPoint.r_out;
                                                    newPoints[i] = updatedPoint;
                                                    onUpdate({ ...value, points: newPoints });
                                                }}
                                            />
                                        ) : (
                                            <CurveDisabledField label="R_OUT" />
                                        )}
                                    />
                                </Row>
                                <Row input>
                                    <Label>P{i} weight</Label>
                                    <CurvePairInput
                                        left={canUseIn ? (
                                            <CurveNumberInput
                                                id={`${id}.p${i}.w_in`}
                                                label="w_in"
                                                value={p.w_in ?? 1}
                                                settings={{ ...settings.points[i].w_in, pad: 2 }}
                                                innerLabelTrim={4}
                                                onUpdate={(w_in) => {
                                                    const newPoints = [...points];
                                                    const updatedPoint: CurvePoint = { ...newPoints[i], w_in };
                                                    if (p.w_in === undefined && w_in === 1) delete updatedPoint.w_in;
                                                    newPoints[i] = updatedPoint;
                                                    onUpdate({ ...value, points: newPoints });
                                                }}
                                            />
                                        ) : (
                                            <CurveDisabledField label="W_IN" />
                                        )}
                                        right={canUseOut ? (
                                            <CurveNumberInput
                                                id={`${id}.p${i}.w_out`}
                                                label="w_out"
                                                value={p.w_out ?? 1}
                                                settings={{ ...settings.points[i].w_out, pad: 2 }}
                                                innerLabelTrim={4}
                                                onUpdate={(w_out) => {
                                                    const newPoints = [...points];
                                                    const updatedPoint: CurvePoint = { ...newPoints[i], w_out };
                                                    if (p.w_out === undefined && w_out === 1) delete updatedPoint.w_out;
                                                    newPoints[i] = updatedPoint;
                                                    onUpdate({ ...value, points: newPoints });
                                                }}
                                            />
                                        ) : (
                                            <CurveDisabledField label="W_OUT" />
                                        )}
                                    />
                                </Row>
                            </>
                        )
                    })()}
                    <br />
                </React.Fragment>
            ))}
        </>
    )
}

// Leva accepts either raw numbers or range objects; settings normalize both forms.
const getSetting = (field: LevaNum | undefined, defMin: number, defMax: number, defStep: number) => {
    const isObj = typeof field === 'object' && field !== null;
    return {
        min: isObj ? field.min ?? defMin : defMin,
        max: isObj ? field.max ?? defMax : defMax,
        step: isObj ? field.step ?? defStep : defStep,
        pad: isObj ? field.pad ?? 2 : 2,
    };
}

export const CurveEditorPlugin = createPlugin<CurveInput, CurveValue, CurveSettings>({
    component: CurveEditorCanvasComponent,
    // Convert user input into stable Leva value/settings objects.
    normalize: (input: CurveInput | null) => {
        const rawPoints = input?.points?.length ? input.points : DEFAULT_POINTS
        const rawSamples = input?.samples ?? DEFAULT_SAMPLES

        const value: CurveValue = {
            samples: typeof rawSamples === 'object' ? rawSamples.value : rawSamples,
            points: rawPoints.map((p, i) => ({
                x: getCurvePointValue(p.x)!,
                y: getCurvePointValue(p.y)!,
                // Endpoints only expose the tangent that points into an actual segment.
                ...(i > 0 && p.r_in !== undefined && { r_in: getCurvePointValue(p.r_in) }),
                ...(i < rawPoints.length - 1 && p.r_out !== undefined && { r_out: getCurvePointValue(p.r_out) }),
                ...(i > 0 && p.w_in !== undefined && { w_in: getCurvePointValue(p.w_in) }),
                ...(i < rawPoints.length - 1 && p.w_out !== undefined && { w_out: getCurvePointValue(p.w_out) }),
            }))
        }

        const settings: CurveSettings = {
            samples: getSetting(rawSamples, 2, 500, 1),
            points: rawPoints.map(p => ({
                x: getSetting(p.x, 0, 1, 0.01),
                y: getSetting(p.y, 0, 1, 0.01),
                r_in: getSetting(p.r_in, -Math.PI / 2, Math.PI / 2, 0.01),
                r_out: getSetting(p.r_out, -Math.PI / 2, Math.PI / 2, 0.01),
                w_in: getSetting(p.w_in, 0, 3, 0.01),
                w_out: getSetting(p.w_out, 0, 3, 0.01),
            }))
        }
        return { value, settings }
    },
    // Clamp edited values and remove stale endpoint tangents before Leva stores them.
    sanitize: (value: CurveValue, settings: CurveSettings) => {
        const samples = Math.max(settings.samples.min, Math.min(settings.samples.max, value.samples))
        const points = value.points.map((p, i) => {
            const s = settings.points[i] || settings.points[settings.points.length - 1]
            const sanitizedPoint: CurvePoint = {
                x: Math.max(s.x.min, Math.min(s.x.max, p.x)),
                y: Math.max(s.y.min, Math.min(s.y.max, p.y)),
            }
            // Drop invalid endpoint tangents even if stale values are present in Leva state.
            if (i > 0 && p.r_in !== undefined) sanitizedPoint.r_in = Math.max(s.r_in.min, Math.min(s.r_in.max, p.r_in))
            if (i < value.points.length - 1 && p.r_out !== undefined) sanitizedPoint.r_out = Math.max(s.r_out.min, Math.min(s.r_out.max, p.r_out))
            if (i > 0 && p.w_in !== undefined) sanitizedPoint.w_in = Math.max(s.w_in.min, Math.min(s.w_in.max, p.w_in))
            if (i < value.points.length - 1 && p.w_out !== undefined) sanitizedPoint.w_out = Math.max(s.w_out.min, Math.min(s.w_out.max, p.w_out))
            return sanitizedPoint
        })
        return { samples, points }
    }
})

export default CurveEditorPlugin

type CurveNumberSettings = { min: number; max: number; step: number; pad?: number }
type TangentHandleType = 'in' | 'out'
type TangentHandleTarget = { pointIndex: number, type: TangentHandleType }
type RangeSetting = {value: number,min?: number,max?: number,step?: number,pad?: number}
type LevaNum = number | RangeSetting

export type CurveInput = {
    points?: CurvePoint[] | {
        x: LevaNum
        y: LevaNum
        r_in?: LevaNum
        r_out?: LevaNum
        w_in?: LevaNum
        w_out?: LevaNum
    }[]
    samples?: LevaNum
}

export type CurveValue = {
    points: CurvePoint[]
    samples: number
}

export type CurveSettings = {
    points: {
        x: { min: number; max: number; step: number };
        y: { min: number; max: number; step: number };
        r_in: { min: number; max: number; step: number };
        r_out: { min: number; max: number; step: number };
        w_in: { min: number; max: number; step: number };
        w_out: { min: number; max: number; step: number };
    }[]
    samples: { min: number; max: number; step: number }
}
