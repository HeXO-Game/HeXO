import { type CellKey, getCellKey, type HexCoordinate } from "@ih3t/shared";

import type {
    BoardHighlight,
    BoardViewState,
    CellLabel,
} from ".";
import type { BoardTheme } from "./themes";
import { axialToUnitPoint, type RenderableCell, traceHexPath } from "./utils";

type DrawBoardOptions = {
    canvas: HTMLCanvasElement;
    view: BoardViewState;
    theme: BoardTheme;
    cells: ReadonlyMap<string, RenderableCell>;
    hoveredCell: HexCoordinate | null;
    emphasizedCells: Set<CellKey>;
    labels: readonly CellLabel[];
    activeHighlight: BoardHighlight | null;
    highlights: readonly BoardHighlight[];
};

export function drawBoard({
    canvas,
    view,
    theme,
    cells,
    hoveredCell,
    emphasizedCells,
    highlights,
    activeHighlight,
    labels,
}: DrawBoardOptions) {
    const context = canvas.getContext(`2d`);
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    if (
        canvas.width !== Math.floor(width * devicePixelRatio)
        || canvas.height !== Math.floor(height * devicePixelRatio)
    ) {
        canvas.width = Math.floor(width * devicePixelRatio);
        canvas.height = Math.floor(height * devicePixelRatio);
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = theme.colors.background;
    context.fillRect(0, 0, width, height);

    const centerX = width / 2 + view.offsetX;
    const centerY = height / 2 + view.offsetY;
    const hexRadius = view.scale * 0.92;

    if (theme.intersectionGrid) {
        drawIntersectionGrid(context, cells, centerX, centerY, view.scale, theme);
    }

    for (const cell of cells.values()) {
        const screenX = centerX + cell.pointX * view.scale;
        const screenY = centerY + cell.pointY * view.scale;
        if (
            screenX + hexRadius < 0
            || screenY + hexRadius < 0
            || screenX - hexRadius > width
            || screenY - hexRadius > height
        ) {
            continue;
        }

        if (!theme.intersectionGrid) {
            traceHexPath(context, screenX, screenY, hexRadius);
            context.strokeStyle = theme.colors.grid;
            context.lineWidth = 1;
            context.stroke();
        }

        if (cell.status === `occupied`) {
            theme.drawCell({
                context,
                cell,
                centerX: screenX,
                centerY: screenY,
                radius: hexRadius,
                scale: view.scale,
            });
        }

        if (emphasizedCells.has(cell.key)) {
            drawEmphasis(context, screenX, screenY, hexRadius, view.scale, theme);
        }
    }

    drawOrigin(context, cells, centerX, centerY, hexRadius, view.scale, theme);
    if (hoveredCell) {
        drawHoveredCell(
            context,
            cells,
            hoveredCell,
            centerX,
            centerY,
            hexRadius,
            view.scale,
            theme,
        );
    }

    for (const highlight of activeHighlight ? [...highlights, activeHighlight] : highlights) {
        drawHighlight(context, highlight, centerX, centerY, hexRadius, view.scale, cells, theme);
    }

    for (const label of labels) {
        const point = axialToUnitPoint(label.x, label.y);
        drawLabel(
            context,
            label.text,
            centerX + point.x * view.scale,
            centerY + point.y * view.scale,
            view.scale,
            theme,
        );
    }
}

function drawIntersectionGrid(
    context: CanvasRenderingContext2D,
    cells: ReadonlyMap<string, RenderableCell>,
    centerX: number,
    centerY: number,
    scale: number,
    theme: BoardTheme,
) {
    context.beginPath();
    for (const cell of cells.values()) {
        for (const [x, y] of [[1, 0], [0, 1], [1, -1]] as const) {
            const neighbor = cells.get(getCellKey(cell.x + x, cell.y + y));
            if (!neighbor) continue;
            context.moveTo(centerX + cell.pointX * scale, centerY + cell.pointY * scale);
            context.lineTo(centerX + neighbor.pointX * scale, centerY + neighbor.pointY * scale);
        }
    }
    context.strokeStyle = theme.colors.grid;
    context.lineWidth = 1;
    context.stroke();
}

function traceCellPath(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    theme: BoardTheme,
) {
    if (!theme.intersectionGrid) {
        traceHexPath(context, centerX, centerY, radius);
        return;
    }
    context.beginPath();
    context.arc(centerX, centerY, radius * 0.78, 0, Math.PI * 2);
}

function drawEmphasis(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    scale: number,
    theme: BoardTheme,
) {
    traceCellPath(context, centerX, centerY, radius - 1, theme);
    context.save();
    context.shadowBlur = Math.max(14, scale * 0.45);
    context.shadowColor = theme.colors.emphasisShadow;
    context.strokeStyle = theme.colors.emphasisStroke;
    context.lineWidth = Math.max(2, scale * 0.08);
    context.stroke();
    context.restore();

    traceCellPath(context, centerX, centerY, Math.max(4, radius - 6), theme);
    context.fillStyle = theme.colors.emphasisFill;
    context.fill();
}

function drawOrigin(
    context: CanvasRenderingContext2D,
    cells: ReadonlyMap<string, RenderableCell>,
    centerX: number,
    centerY: number,
    radius: number,
    scale: number,
    theme: BoardTheme,
) {
    const origin = cells.get(getCellKey(0, 0));
    if (!origin) return;

    const screenX = centerX + origin.pointX * scale;
    const screenY = centerY + origin.pointY * scale;
    context.save();
    traceCellPath(context, screenX, screenY, Math.max(4, radius - 5), theme);
    context.fillStyle = theme.colors.originFill;
    context.fill();
    traceCellPath(context, screenX, screenY, radius - 1.5, theme);
    context.strokeStyle = theme.colors.originStroke;
    context.lineWidth = Math.max(1.5, scale * 0.024);
    context.stroke();
    context.restore();
}

function drawHoveredCell(
    context: CanvasRenderingContext2D,
    cells: ReadonlyMap<string, RenderableCell>,
    hoveredCell: HexCoordinate,
    centerX: number,
    centerY: number,
    radius: number,
    scale: number,
    theme: BoardTheme,
) {
    if (cells.get(getCellKey(hoveredCell.x, hoveredCell.y))?.status !== `empty`) return;

    const point = axialToUnitPoint(hoveredCell.x, hoveredCell.y);
    traceCellPath(context, centerX + point.x * scale, centerY + point.y * scale, radius, theme);
    context.fillStyle = theme.colors.hoverFill;
    context.fill();
    context.strokeStyle = theme.colors.hoverStroke;
    context.lineWidth = 1.5;
    context.stroke();
}

function drawLabel(
    context: CanvasRenderingContext2D,
    label: string,
    centerX: number,
    centerY: number,
    scale: number,
    theme: BoardTheme,
) {
    context.save();
    context.fillStyle = theme.colors.label;
    context.font = `600 ${Math.max(9, scale * 0.28)}px sans-serif`;
    context.textAlign = `center`;
    context.textBaseline = `middle`;
    context.fillText(label, centerX, centerY, scale * 1.45);
    context.restore();
}

function drawHighlight(
    context: CanvasRenderingContext2D,
    highlight: BoardHighlight,
    centerX: number,
    centerY: number,
    radius: number,
    scale: number,
    cells: ReadonlyMap<string, RenderableCell>,
    theme: BoardTheme,
) {
    if (highlight.cells.length === 0) return;

    const points = highlight.cells.map(cell => {
        const point = axialToUnitPoint(cell.x, cell.y);
        return { x: centerX + point.x * scale, y: centerY + point.y * scale };
    });

    context.save();
    context.lineCap = `round`;
    context.lineJoin = `round`;

    if (highlight.kind === `cell`) {
        const point = points[0];
        traceCellPath(context, point.x, point.y, Math.max(4, radius - 2), theme);
        context.strokeStyle = withOpacity(highlight.color, 0.96);
        context.lineWidth = Math.max(2, scale * 0.085);
        context.shadowBlur = Math.max(14, scale * 0.28);
        context.shadowColor = withOpacity(highlight.color, 0.35);
        context.stroke();

        const target = highlight.cells[0];
        if (cells.get(getCellKey(target.x, target.y))?.status === `occupied`) {
            context.beginPath();
            context.arc(point.x, point.y, Math.max(2, scale * 0.12), 0, Math.PI * 2);
            context.fillStyle = theme.colors.highlightDot;
            context.fill();
        } else {
            traceCellPath(context, point.x, point.y, Math.max(3, radius - 6), theme);
            context.fillStyle = withOpacity(highlight.color, 0.14);
            context.fill();
        }
    } else {
        const markerWidth = Math.max(6, scale * 0.24);
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) context.lineTo(point.x, point.y);
        context.strokeStyle = theme.colors.highlightLineShadow;
        context.lineWidth = markerWidth + Math.max(2.5, scale * 0.08);
        context.shadowBlur = Math.max(18, scale * 0.34);
        context.shadowColor = theme.colors.highlightLineShadow;
        context.stroke();
        context.shadowBlur = 0;
        context.strokeStyle = withOpacity(highlight.color, 0.92);
        context.lineWidth = markerWidth;
        context.stroke();
    }

    context.restore();
}

function withOpacity(color: string, opacity: number): string {
    const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());
    if (!match) return color;
    const hex = match[1].length === 3
        ? [...match[1]].map(value => `${value}${value}`).join(``)
        : match[1];
    return `rgba(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)}, ${opacity})`;
}
