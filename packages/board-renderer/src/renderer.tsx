import { getCellKey, type HexCoordinate } from "@ih3t/shared";
import { useEffect, useRef } from "react";

import type { BoardController, BoardHighlight, BoardState } from ".";
import { drawBoard } from "./drawing";
import {
    buildRenderableCells,
    buildStraightHexLine,
    clampScale,
    pixelToAxial,
    type RenderableCell,
    sameCell,
} from "./utils";

const DRAG_THRESHOLD_PX = 6;
const MOUSE_AFTER_TOUCH_IGNORE_MS = 500;
const HIGHLIGHT_COLORS = {
    neutral: `#f472b6`,
    yellow: `#fbbf24`,
    blue: `#38bdf8`,
} as const;

type RendererOptions = {
    state: BoardState
    viewInteractionEnabled: boolean
    cellInteractionEnabled: boolean
    onPlaceCell?: (cell: HexCoordinate) => void
    onCellHover?: (cell: HexCoordinate | null) => void
};

type DragState = {
    startX: number
    startY: number
    originOffsetX: number
    originOffsetY: number
    moved: boolean
};

type PinchState = {
    startDistance: number
    startScale: number
    anchorUnitX: number
    anchorUnitY: number
};

type MutableHighlight = {
    kind: `cell` | `line`
    cells: HexCoordinate[]
    color: string
};

type HighlightPointerState = {
    startCell: HexCoordinate
    pointerButtonsMask: 1 | 2
    highlight: MutableHighlight
};

class CanvasBoardRenderer {
    private options: RendererOptions;
    private cells: Map<string, RenderableCell>;
    private pendingAnimationFrame: number | null = null;
    private hoveredCell: HexCoordinate | null = null;
    private dragState: DragState | null = null;
    private pinchState: PinchState | null = null;
    private highlightPointerState: HighlightPointerState | null = null;
    private suppressTouchPlacement = false;
    private lastTouchInteractionAt = 0;
    private readonly eventAbortController = new AbortController();
    private readonly resizeObserver: ResizeObserver;
    private readonly unsubscribeController: () => void;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly controller: BoardController,
        options: RendererOptions,
    ) {
        this.options = options;
        this.cells = buildRenderableCells(options.state);
        this.unsubscribeController = controller.subscribe(this.scheduleDraw);
        this.resizeObserver = new ResizeObserver(this.scheduleDraw);
        this.resizeObserver.observe(canvas);
        this.attachEvents();
        this.scheduleDraw();
    }

    update(options: RendererOptions) {
        if (options.state !== this.options.state) {
            this.cells = buildRenderableCells(options.state);
        }
        this.options = options;
        if (!options.cellInteractionEnabled) {
            this.clearHoveredCell();
        }
        this.scheduleDraw();
    }

    destroy() {
        this.clearHoveredCell();
        this.eventAbortController.abort();
        this.resizeObserver.disconnect();
        this.unsubscribeController();
        if (this.pendingAnimationFrame !== null) {
            cancelAnimationFrame(this.pendingAnimationFrame);
            this.pendingAnimationFrame = null;
        }
    }

    private readonly scheduleDraw = () => {
        if (this.pendingAnimationFrame !== null) {
            return;
        }

        this.pendingAnimationFrame = requestAnimationFrame(() => {
            this.pendingAnimationFrame = null;
            drawBoard({
                canvas: this.canvas,
                view: this.controller.getViewState(),

                labels: this.options.state.labels ?? [],

                cells: this.cells,
                hoveredCell: this.hoveredCell,
                emphasizedCells: this.controller.getEmphasizedCells(),

                highlights: this.controller.getHighlights(),
                activeHighlight: this.highlightPointerState?.highlight ?? null,
            });
        });
    };

    private attachEvents() {
        const signal = this.eventAbortController.signal;
        this.canvas.addEventListener(`contextmenu`, this.onContextMenu, { signal });
        this.canvas.addEventListener(`mousedown`, this.onMouseDown, { signal });
        this.canvas.addEventListener(`mousemove`, this.onMouseMove, { signal });
        this.canvas.addEventListener(`mouseleave`, this.onMouseLeave, { signal });
        this.canvas.addEventListener(`mouseup`, this.onMouseUp, { signal });
        this.canvas.addEventListener(`wheel`, this.onWheel, { passive: false, signal });
        this.canvas.addEventListener(`touchstart`, this.onTouchStart, { passive: false, signal });
        this.canvas.addEventListener(`touchmove`, this.onTouchMove, { passive: false, signal });
        this.canvas.addEventListener(`touchend`, this.onTouchEnd, { passive: false, signal });
        this.canvas.addEventListener(`touchcancel`, this.onTouchCancel, { passive: false, signal });
    }

    private readonly onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
    };

    private readonly onMouseDown = (event: MouseEvent) => {
        if (this.shouldIgnoreMouseEvent()) {
            return;
        }

        if (this.options.viewInteractionEnabled) {
            const isHighlightGesture = event.button === 2
                || (event.button === 0 && event.shiftKey);
            if (isHighlightGesture) {
                event.preventDefault();
                this.startHighlight(
                    event.clientX,
                    event.clientY,
                    event.button === 2 ? 2 : 1,
                    event.button === 2 && (event.shiftKey || event.ctrlKey)
                        ? HIGHLIGHT_COLORS.yellow
                        : event.altKey
                            ? HIGHLIGHT_COLORS.blue
                            : HIGHLIGHT_COLORS.neutral,
                );
                return;
            }
        }

        if (event.button !== 0) {
            return;
        }

        const view = this.controller.getViewState();
        this.dragState = {
            startX: event.clientX,
            startY: event.clientY,
            originOffsetX: view.offsetX,
            originOffsetY: view.offsetY,
            moved: false,
        };
    };

    private readonly onMouseMove = (event: MouseEvent) => {
        if (this.shouldIgnoreMouseEvent()) {
            return;
        }

        if (this.highlightPointerState) {
            if ((event.buttons & this.highlightPointerState.pointerButtonsMask) === 0) {
                this.finishHighlight(event.clientX, event.clientY);
            } else {
                this.extendHighlight(event.clientX, event.clientY);
            }
            return;
        }

        this.updateHoveredCell(event.clientX, event.clientY);

        const drag = this.dragState;
        if (!drag) {
            return;
        }

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;
        if (Math.abs(deltaX) > DRAG_THRESHOLD_PX || Math.abs(deltaY) > DRAG_THRESHOLD_PX) {
            drag.moved = true;
        }

        if (this.options.viewInteractionEnabled) {
            this.controller.updateViewState({
                offsetX: drag.originOffsetX + deltaX,
                offsetY: drag.originOffsetY + deltaY,
            });
        }
    };

    private readonly onMouseLeave = () => {
        if (this.shouldIgnoreMouseEvent()) {
            return;
        }

        const needsRedraw = this.hoveredCell !== null || this.highlightPointerState !== null;
        this.clearHoveredCell();
        this.dragState = null;
        this.highlightPointerState = null;
        if (needsRedraw) {
            this.scheduleDraw();
        }
    };

    private readonly onMouseUp = (event: MouseEvent) => {
        if (this.shouldIgnoreMouseEvent()) {
            return;
        }

        if (
            event.button === 2
            || (event.button === 0 && this.highlightPointerState?.pointerButtonsMask === 1)
        ) {
            event.preventDefault();
            this.finishHighlight(event.clientX, event.clientY);
            return;
        }

        if (event.button !== 0) {
            return;
        }

        const drag = this.dragState;
        this.dragState = null;
        if (!drag?.moved) {
            this.tryPlaceCell(event.clientX, event.clientY);
        }
    };

    private readonly onWheel = (event: WheelEvent) => {
        if (!this.options.viewInteractionEnabled) {
            return;
        }

        event.preventDefault();
        const view = this.controller.getViewState();
        const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
        this.zoomAtClientPoint(event.clientX, event.clientY, view.scale * zoomFactor);
    };

    private readonly onTouchStart = (event: TouchEvent) => {
        if (!this.options.viewInteractionEnabled && !this.options.cellInteractionEnabled) {
            return;
        }

        event.preventDefault();
        this.markTouchInteraction();

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const view = this.controller.getViewState();
            this.suppressTouchPlacement = false;
            this.updateHoveredCell(touch.clientX, touch.clientY);
            this.dragState = {
                startX: touch.clientX,
                startY: touch.clientY,
                originOffsetX: view.offsetX,
                originOffsetY: view.offsetY,
                moved: false,
            };
            this.pinchState = null;
            return;
        }

        this.suppressTouchPlacement = true;
        this.startPinch(event.touches);
    };

    private readonly onTouchMove = (event: TouchEvent) => {
        if (!this.options.viewInteractionEnabled && !this.options.cellInteractionEnabled) {
            return;
        }

        event.preventDefault();
        this.markTouchInteraction();

        if (event.touches.length >= 2) {
            this.suppressTouchPlacement = true;
            this.updatePinch(event.touches);
            return;
        }

        const drag = this.dragState;
        const touch = event.touches[0];
        if (!drag || !touch) {
            return;
        }

        this.updateHoveredCell(touch.clientX, touch.clientY);
        const deltaX = touch.clientX - drag.startX;
        const deltaY = touch.clientY - drag.startY;
        if (Math.abs(deltaX) > DRAG_THRESHOLD_PX || Math.abs(deltaY) > DRAG_THRESHOLD_PX) {
            drag.moved = true;
        }

        if (drag.moved && this.options.viewInteractionEnabled) {
            this.controller.updateViewState({
                offsetX: drag.originOffsetX + deltaX,
                offsetY: drag.originOffsetY + deltaY,
            });
        }
    };

    private readonly onTouchEnd = (event: TouchEvent) => {
        if (!this.options.viewInteractionEnabled && !this.options.cellInteractionEnabled) {
            return;
        }

        event.preventDefault();
        this.markTouchInteraction();

        if (event.touches.length >= 2) {
            this.suppressTouchPlacement = true;
            this.startPinch(event.touches);
            return;
        }

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const view = this.controller.getViewState();
            this.updateHoveredCell(touch.clientX, touch.clientY);
            this.dragState = {
                startX: touch.clientX,
                startY: touch.clientY,
                originOffsetX: view.offsetX,
                originOffsetY: view.offsetY,
                moved: false,
            };
            this.pinchState = null;
            return;
        }

        const drag = this.dragState;
        const lastTouch = event.changedTouches[0];
        if (!this.suppressTouchPlacement && !drag?.moved && lastTouch) {
            this.tryPlaceCell(lastTouch.clientX, lastTouch.clientY);
        }

        this.suppressTouchPlacement = false;
        this.clearHoveredCell();
        this.clearGestureState();
        this.scheduleDraw();
    };

    private readonly onTouchCancel = (event: TouchEvent) => {
        event.preventDefault();
        this.markTouchInteraction();
        this.suppressTouchPlacement = false;
        this.clearHoveredCell();
        this.clearGestureState();
        this.scheduleDraw();
    };

    private updateHoveredCell(clientX: number, clientY: number) {
        const nextCell = this.options.cellInteractionEnabled
            ? this.screenToCell(clientX, clientY)
            : null;
        if (!sameCell(this.hoveredCell, nextCell)) {
            this.hoveredCell = nextCell;
            this.options.onCellHover?.(nextCell);
            this.scheduleDraw();
        }
    }

    private clearHoveredCell() {
        if (this.hoveredCell !== null) {
            this.hoveredCell = null;
            this.options.onCellHover?.(null);
        }
    }

    private tryPlaceCell(clientX: number, clientY: number) {
        if (!this.options.cellInteractionEnabled) {
            return;
        }

        const target = this.screenToCell(clientX, clientY);
        if (!target || this.cells.get(getCellKey(target.x, target.y))?.status !== `empty`) {
            return;
        }

        this.options.onPlaceCell?.(target);
    }

    private screenToCell(clientX: number, clientY: number): HexCoordinate {
        const rect = this.canvas.getBoundingClientRect();
        const view = this.controller.getViewState();
        return pixelToAxial(
            (clientX - rect.left - rect.width / 2 - view.offsetX) / view.scale,
            (clientY - rect.top - rect.height / 2 - view.offsetY) / view.scale,
        );
    }

    private zoomAtClientPoint(clientX: number, clientY: number, scale: number) {
        const rect = this.canvas.getBoundingClientRect();
        const view = this.controller.getViewState();
        const nextScale = clampScale(scale);
        const anchorX = (clientX - rect.left - rect.width / 2 - view.offsetX) / view.scale;
        const anchorY = (clientY - rect.top - rect.height / 2 - view.offsetY) / view.scale;
        this.controller.updateViewState({
            scale: nextScale,
            offsetX: clientX - rect.left - rect.width / 2 - anchorX * nextScale,
            offsetY: clientY - rect.top - rect.height / 2 - anchorY * nextScale,
        });
    }

    private startHighlight(
        clientX: number,
        clientY: number,
        pointerButtonsMask: 1 | 2,
        color: string,
    ) {
        const target = this.screenToCell(clientX, clientY);
        if (!this.cells.has(getCellKey(target.x, target.y))) {
            return;
        }

        this.highlightPointerState = {
            startCell: target,
            pointerButtonsMask,
            highlight: { kind: `cell`, cells: [target], color },
        };
        this.clearHoveredCell();
        this.dragState = null;
        this.pinchState = null;
        this.scheduleDraw();
    }

    private extendHighlight(clientX: number, clientY: number) {
        const pointer = this.highlightPointerState;
        if (!pointer) {
            return;
        }

        const target = this.screenToCell(clientX, clientY);
        const cells = buildStraightHexLine(pointer.startCell, target)
            .filter(cell => this.cells.has(getCellKey(cell.x, cell.y)));
        pointer.highlight.cells = cells;
        pointer.highlight.kind = cells.length > 1 ? `line` : `cell`;
        this.scheduleDraw();
    }

    private finishHighlight(clientX: number, clientY: number) {
        const pointer = this.highlightPointerState;
        this.highlightPointerState = null;
        if (!pointer) {
            return;
        }

        const target = this.screenToCell(clientX, clientY);
        const highlights = [...this.controller.getHighlights()];

        if (pointer.highlight.kind === `cell`) {
            const existingIndex = findHighlightAtCell(highlights, target);
            if (existingIndex >= 0) {
                highlights.splice(existingIndex, 1);
            } else {
                highlights.push(pointer.highlight);
            }
        } else {
            pointer.highlight.cells = buildStraightHexLine(pointer.startCell, target)
                .filter(cell => this.cells.has(getCellKey(cell.x, cell.y)));
            highlights.push(pointer.highlight);
        }

        this.controller.setHighlights(highlights);
    }

    private startPinch(touches: TouchList) {
        if (!this.options.viewInteractionEnabled) {
            return;
        }

        const center = getTouchCenter(touches);
        const distance = getTouchDistance(touches);
        if (!center || distance === 0) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const view = this.controller.getViewState();
        this.pinchState = {
            startDistance: distance,
            startScale: view.scale,
            anchorUnitX: (center.x - rect.left - rect.width / 2 - view.offsetX) / view.scale,
            anchorUnitY: (center.y - rect.top - rect.height / 2 - view.offsetY) / view.scale,
        };
        this.dragState = null;
        this.clearHoveredCell();
        this.scheduleDraw();
    }

    private updatePinch(touches: TouchList) {
        const pinch = this.pinchState;
        const center = getTouchCenter(touches);
        const distance = getTouchDistance(touches);
        if (!pinch || !center || distance === 0) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const scale = clampScale(pinch.startScale * (distance / pinch.startDistance));
        this.controller.updateViewState({
            scale,
            offsetX: center.x - rect.left - rect.width / 2 - pinch.anchorUnitX * scale,
            offsetY: center.y - rect.top - rect.height / 2 - pinch.anchorUnitY * scale,
        });
        this.clearHoveredCell();
    }

    private clearGestureState() {
        this.dragState = null;
        this.pinchState = null;
        this.highlightPointerState = null;
    }

    private markTouchInteraction() {
        this.lastTouchInteractionAt = Date.now();
    }

    private shouldIgnoreMouseEvent() {
        return Date.now() - this.lastTouchInteractionAt < MOUSE_AFTER_TOUCH_IGNORE_MS;
    }
}

export type GameBoardRendererProps = Readonly<{
    state: BoardState
    controller: BoardController
    viewInteractionEnabled?: boolean
    cellInteractionEnabled?: boolean
    onPlaceCell?: (cell: HexCoordinate) => void
    onCellHover?: (cell: HexCoordinate | null) => void
    className?: string
}>;

export function GameBoardRenderer({
    state,
    controller,
    viewInteractionEnabled = true,
    cellInteractionEnabled = false,
    onPlaceCell,
    onCellHover,
    className,
}: GameBoardRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<CanvasBoardRenderer | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const renderer = new CanvasBoardRenderer(canvas, controller, {
            state,
            viewInteractionEnabled,
            cellInteractionEnabled,
            onPlaceCell,
            onCellHover,
        });
        rendererRef.current = renderer;
        return () => {
            renderer.destroy();
            rendererRef.current = null;
        };
    }, [controller]);

    useEffect(() => {
        rendererRef.current?.update({
            state,
            viewInteractionEnabled,
            cellInteractionEnabled,
            onPlaceCell,
            onCellHover,
        });
    }, [state, viewInteractionEnabled, cellInteractionEnabled, onPlaceCell, onCellHover]);

    const cursor = viewInteractionEnabled
        ? `grab`
        : cellInteractionEnabled
            ? `default`
            : `not-allowed`;

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ cursor, touchAction: `none`, userSelect: `none` }}
            role="img"
        />
    );
}

function findHighlightAtCell(
    highlights: readonly BoardHighlight[],
    target: HexCoordinate,
): number {
    for (let index = highlights.length - 1; index >= 0; index -= 1) {
        if (highlights[index].cells.some(cell => sameCell(cell, target))) {
            return index;
        }
    }
    return -1;
}

function getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) {
        return 0;
    }

    return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
    );
}

function getTouchCenter(touches: TouchList) {
    if (touches.length === 0) {
        return null;
    }
    if (touches.length === 1) {
        return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
    };
}
