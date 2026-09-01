import { getCellKey, CellKey, type HexCoordinate } from "@ih3t/shared";

import type { BoardHighlight, BoardViewState, CellLabel, CellMarker } from ".";
import { axialToUnitPoint, type RenderableCell, traceHexPath } from "./utils";

const GRID_LINE_COLOR = `rgba(148, 163, 184, 0.18)`;

type RgbColor = {
    r: number;
    g: number;
    b: number;
};

type DrawBoardOptions = {
    canvas: HTMLCanvasElement;
    view: BoardViewState;

    cells: ReadonlyMap<string, RenderableCell>;
    hoveredCell: HexCoordinate | null;
    emphasizedCells: Set<CellKey>;

    labels: readonly CellLabel[];

    activeHighlight: BoardHighlight | null;
    highlights: readonly BoardHighlight[];
};

type TilePieceMarkerPalette = {
    tileTintColor: string;
    tileOutlineShadowColor: string;
    tileOutlineColor: string;
    markerShadowColor: string;
    markerOutlineColor: string;
    markerFillColor: string;
    accentColor: string;
};

export function drawBoard({
    canvas,
    view,

    cells,
    hoveredCell,
    emphasizedCells,

    highlights,
    activeHighlight,

    labels,
}: DrawBoardOptions) {
    const context = canvas.getContext(`2d`);
    if (!context) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    if (
        canvas.width !== Math.floor(width * devicePixelRatio) ||
        canvas.height !== Math.floor(height * devicePixelRatio)
    ) {
        canvas.width = Math.floor(width * devicePixelRatio);
        canvas.height = Math.floor(height * devicePixelRatio);
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = `#0f172a`;
    context.fillRect(0, 0, width, height);

    const centerX = width / 2 + view.offsetX;
    const centerY = height / 2 + view.offsetY;
    const hexRadius = view.scale * 0.92;
    for (const cell of cells.values()) {
        const screenX = centerX + cell.pointX * view.scale;
        const screenY = centerY + cell.pointY * view.scale;

        if (
            screenX + hexRadius < 0 ||
            screenY + hexRadius < 0 ||
            screenX - hexRadius > width ||
            screenY - hexRadius > height
        ) {
            continue;
        }

        traceHexPath(context, screenX, screenY, hexRadius);
        context.strokeStyle = GRID_LINE_COLOR;
        context.lineWidth = 1;
        context.stroke();

        if (cell.status === `occupied`) {
            drawPlacedCell(
                context,
                cell,
                screenX,
                screenY,
                hexRadius,
                view.scale,
            );
        }

        if (emphasizedCells.has(cell.key)) {
            drawEmphasis(context, screenX, screenY, hexRadius, view.scale);
        }
    }

    drawOrigin(context, cells, centerX, centerY, hexRadius, view.scale);

    if (hoveredCell) {
        drawHoveredCell(
            context,
            cells,
            hoveredCell,
            centerX,
            centerY,
            hexRadius,
            view.scale,
        );
    }

    const highlightsToDraw = activeHighlight
        ? [...highlights, activeHighlight]
        : highlights;
    for (const highlight of highlightsToDraw) {
        drawHighlight(
            context,
            highlight,
            centerX,
            centerY,
            hexRadius,
            view.scale,
            cells,
        );
    }

    for (const label of labels) {
        const point = axialToUnitPoint(label.x, label.y);
        drawLabel(
            context,
            label.text,
            centerX + point.x * view.scale,
            centerY + point.y * view.scale,
            view.scale,
        );
    }
}

function drawPlacedCell(
    context: CanvasRenderingContext2D,
    cell: Extract<RenderableCell, { status: `occupied` }>,
    screenX: number,
    screenY: number,
    hexRadius: number,
    scale: number,
) {
    if (!cell.marker) {
        traceHexPath(context, screenX, screenY, hexRadius - 2);
        context.fillStyle = cell.color;
        context.fill();
        return;
    }

    const palette = getTilePieceMarkerPalette(cell.color);

    traceHexPath(context, screenX, screenY, hexRadius - 2);
    context.fillStyle = palette.tileTintColor;
    context.fill();

    traceHexPath(context, screenX, screenY, hexRadius - 2);
    context.strokeStyle = palette.tileOutlineShadowColor;
    context.lineWidth = Math.max(2.5, scale * 0.09);
    context.stroke();

    traceHexPath(context, screenX, screenY, hexRadius - 2);
    context.strokeStyle = palette.tileOutlineColor;
    context.lineWidth = Math.max(1.6, scale * 0.055);
    context.stroke();

    drawTilePieceMarker(
        context,
        cell.marker,
        screenX,
        screenY,
        hexRadius,
        palette,
    );
}

function drawEmphasis(
    context: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    hexRadius: number,
    scale: number,
) {
    traceHexPath(context, screenX, screenY, hexRadius - 1);
    context.save();
    context.shadowBlur = Math.max(14, scale * 0.45);
    context.shadowColor = `rgba(248, 250, 252, 0.52)`;
    context.strokeStyle = `rgba(248, 250, 252, 0.96)`;
    context.lineWidth = Math.max(2, scale * 0.08);
    context.stroke();
    context.restore();

    traceHexPath(context, screenX, screenY, Math.max(4, hexRadius - 6));
    context.fillStyle = `rgba(255, 255, 255, 0.12)`;
    context.fill();
}

function drawLabel(
    context: CanvasRenderingContext2D,
    label: string,
    screenX: number,
    screenY: number,
    scale: number,
) {
    context.save();
    context.fillStyle = `rgba(248, 250, 252, 0.96)`;
    context.font = `600 ${Math.max(9, scale * 0.28)}px sans-serif`;
    context.textAlign = `center`;
    context.textBaseline = `middle`;
    context.fillText(label, screenX, screenY, scale * 1.45);
    context.restore();
}

function drawOrigin(
    context: CanvasRenderingContext2D,
    cells: ReadonlyMap<string, RenderableCell>,
    centerX: number,
    centerY: number,
    hexRadius: number,
    scale: number,
) {
    const origin = cells.get(getCellKey(0, 0));
    if (!origin) {
        return;
    }

    const screenX = centerX + origin.pointX * scale;
    const screenY = centerY + origin.pointY * scale;
    const color = { r: 248, g: 211, b: 208 };

    context.save();
    traceHexPath(context, screenX, screenY, Math.max(4, hexRadius - 5));
    context.fillStyle = withAlpha(color, 0.12);
    context.fill();
    traceHexPath(context, screenX, screenY, hexRadius - 1.5);
    context.strokeStyle = withAlpha(color, 0.62);
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
    hexRadius: number,
    scale: number,
) {
    const cell = cells.get(getCellKey(hoveredCell.x, hoveredCell.y));
    if (cell?.status !== `empty`) {
        return;
    }

    const point = axialToUnitPoint(hoveredCell.x, hoveredCell.y);
    const screenX = centerX + point.x * scale;
    const screenY = centerY + point.y * scale;
    traceHexPath(context, screenX, screenY, hexRadius);
    context.fillStyle = `rgba(125, 211, 252, 0.18)`;
    context.fill();
    context.strokeStyle = `rgba(125, 211, 252, 0.55)`;
    context.lineWidth = 1.5;
    context.stroke();
}

function drawHighlight(
    context: CanvasRenderingContext2D,
    highlight: BoardHighlight,
    centerX: number,
    centerY: number,
    hexRadius: number,
    scale: number,
    cells: ReadonlyMap<string, RenderableCell>,
) {
    if (highlight.cells.length === 0) {
        return;
    }

    const points = highlight.cells.map((cell) => {
        const point = axialToUnitPoint(cell.x, cell.y);
        return {
            screenX: centerX + point.x * scale,
            screenY: centerY + point.y * scale,
        };
    });

    context.save();
    context.lineCap = `round`;
    context.lineJoin = `round`;

    if (highlight.kind === `cell`) {
        const point = points[0];
        traceHexPath(
            context,
            point.screenX,
            point.screenY,
            Math.max(4, hexRadius - 2),
        );
        context.strokeStyle = withOpacity(highlight.color, 0.96);
        context.lineWidth = Math.max(2, scale * 0.085);
        context.shadowBlur = Math.max(14, scale * 0.28);
        context.shadowColor = withOpacity(highlight.color, 0.35);
        context.stroke();

        const target = highlight.cells[0];
        const cell = cells.get(getCellKey(target.x, target.y));
        if (cell?.status === `occupied`) {
            context.beginPath();
            context.arc(
                point.screenX,
                point.screenY,
                Math.max(2, scale * 0.12),
                0,
                Math.PI * 2,
            );
            context.fillStyle = `rgba(255, 255, 255, 0.92)`;
            context.fill();
        } else {
            traceHexPath(
                context,
                point.screenX,
                point.screenY,
                Math.max(3, hexRadius - 6),
            );
            context.fillStyle = withOpacity(highlight.color, 0.14);
            context.fill();
        }
    } else {
        const markerWidth = Math.max(6, scale * 0.24);
        context.beginPath();
        context.moveTo(points[0].screenX, points[0].screenY);
        for (const point of points.slice(1)) {
            context.lineTo(point.screenX, point.screenY);
        }
        context.strokeStyle = `rgba(15, 23, 42, 0.34)`;
        context.lineWidth = markerWidth + Math.max(2.5, scale * 0.08);
        context.shadowBlur = Math.max(18, scale * 0.34);
        context.shadowColor = `rgba(15, 23, 42, 0.2)`;
        context.stroke();
        context.shadowBlur = 0;
        context.strokeStyle = withOpacity(highlight.color, 0.92);
        context.lineWidth = markerWidth;
        context.stroke();
    }

    context.restore();
}

function traceTilePieceXPath(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
) {
    context.beginPath();
    context.moveTo(centerX - radius, centerY - radius);
    context.lineTo(centerX + radius, centerY + radius);
    context.moveTo(centerX + radius, centerY - radius);
    context.lineTo(centerX - radius, centerY + radius);
}

function traceTilePieceOPath(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
) {
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
}

function drawTilePieceMarker(
    context: CanvasRenderingContext2D,
    marker: CellMarker,
    centerX: number,
    centerY: number,
    hexRadius: number,
    palette: TilePieceMarkerPalette,
) {
    const markerRadius = Math.max(5, hexRadius * 0.36);
    const lineWidth = Math.max(2.25, hexRadius * 0.16);
    const traceMarker =
        marker === `X` ? traceTilePieceXPath : traceTilePieceOPath;

    context.save();
    traceHexPath(context, centerX, centerY, Math.max(4, hexRadius - 4));
    context.clip();
    context.lineCap = `round`;
    context.lineJoin = `round`;

    context.save();
    context.translate(lineWidth * 0.14, lineWidth * 0.18);
    traceMarker(context, centerX, centerY, markerRadius);
    context.strokeStyle = palette.markerShadowColor;
    context.lineWidth = lineWidth + Math.max(1.5, hexRadius * 0.04);
    context.stroke();
    context.restore();

    traceMarker(context, centerX, centerY, markerRadius);
    context.strokeStyle = palette.markerOutlineColor;
    context.lineWidth = lineWidth + Math.max(0.75, hexRadius * 0.02);
    context.stroke();

    traceMarker(context, centerX, centerY, markerRadius);
    context.strokeStyle = palette.markerFillColor;
    context.lineWidth = Math.max(1.5, lineWidth * 0.7);
    context.stroke();

    traceMarker(context, centerX, centerY, markerRadius);
    context.strokeStyle = palette.accentColor;
    context.lineWidth = Math.max(1, lineWidth * 0.34);
    context.stroke();
    context.restore();
}

function getTilePieceMarkerPalette(tileColor: string): TilePieceMarkerPalette {
    const color = parseHexColor(tileColor);
    if (!color) {
        return {
            tileTintColor: `rgba(255, 255, 255, 0.04)`,
            tileOutlineShadowColor: `rgba(15, 23, 42, 0.38)`,
            tileOutlineColor: `rgba(226, 232, 240, 0.92)`,
            markerShadowColor: `rgba(15, 23, 42, 0.26)`,
            markerOutlineColor: `rgba(15, 23, 42, 0.96)`,
            markerFillColor: `rgba(226, 232, 240, 0.98)`,
            accentColor: `rgba(255, 255, 255, 0.18)`,
        };
    }

    const slate900 = { r: 15, g: 23, b: 42 };
    const slate950 = { r: 2, g: 6, b: 23 };
    const white = { r: 255, g: 255, b: 255 };
    const luminance =
        (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
    const tileOutline =
        luminance > 0.72
            ? mixColor(color, slate900, 0.12)
            : mixColor(color, white, 0.06);

    return {
        tileTintColor: withAlpha(mixColor(color, white, 0.2), 0.08),
        tileOutlineShadowColor: withAlpha(mixColor(color, slate950, 0.8), 0.42),
        tileOutlineColor: withAlpha(tileOutline, 0.98),
        markerShadowColor: withAlpha(mixColor(color, slate950, 0.72), 0.28),
        markerOutlineColor: withAlpha(
            mixColor(color, slate950, luminance > 0.62 ? 0.82 : 0.74),
            0.98,
        ),
        markerFillColor: withAlpha(color, 0.98),
        accentColor: withAlpha(
            mixColor(color, white, luminance > 0.62 ? 0.22 : 0.38),
            luminance > 0.62 ? 0.18 : 0.22,
        ),
    };
}

function parseHexColor(color: string): RgbColor | null {
    const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());
    if (!match) {
        return null;
    }

    const value = match[1];
    if (value.length === 3) {
        return {
            r: Number.parseInt(`${value[0]}${value[0]}`, 16),
            g: Number.parseInt(`${value[1]}${value[1]}`, 16),
            b: Number.parseInt(`${value[2]}${value[2]}`, 16),
        };
    }

    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    };
}

function mixColor(base: RgbColor, target: RgbColor, amount: number): RgbColor {
    const safeAmount = Math.max(0, Math.min(1, amount));
    return {
        r: clampChannel(base.r + (target.r - base.r) * safeAmount),
        g: clampChannel(base.g + (target.g - base.g) * safeAmount),
        b: clampChannel(base.b + (target.b - base.b) * safeAmount),
    };
}

function clampChannel(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function withAlpha(color: RgbColor, alpha: number): string {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function withOpacity(color: string, opacity: number): string {
    const parsed = parseHexColor(color);
    return parsed ? withAlpha(parsed, opacity) : color;
}
