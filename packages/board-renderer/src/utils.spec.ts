import assert from "node:assert/strict";
import { test } from "node:test";

import { BoardController } from ".";
import {
    axialToUnitPoint,
    buildRenderableCells,
    buildStraightHexLine,
    pixelToAxial,
} from "./utils";

test(`hex coordinates survive a pixel round trip`, () => {
    for (const cell of [{ x: 0, y: 0 }, { x: 7, y: -4 }, { x: -12, y: 9 }]) {
        const point = axialToUnitPoint(cell.x, cell.y);
        assert.deepEqual(pixelToAxial(point.x, point.y), cell);
    }
});

test(`renderable cells include occupied cells and their placement area`, () => {
    const cells = buildRenderableCells({
        placedCells: [{ x: 0, y: 0, color: `#fff` }],
    });

    assert.equal(cells.get(`0,0`)?.status, `occupied`);
    assert.equal(cells.has(`8,0`), true);
    assert.equal(cells.has(`9,0`), false);
});

test(`straight highlights snap to a hex axis`, () => {
    assert.deepEqual(
        buildStraightHexLine({ x: 0, y: 0 }, { x: 3, y: 1 }),
        [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 3, y: 0 },
            { x: 4, y: 0 },
        ],
    );
});

test(`resetting the view preserves overlays`, () => {
    const controller = new BoardController();
    controller.setEmphasizedCells([{ x: 2, y: -1 }]);
    controller.updateViewState({ offsetX: 20, scale: Number.POSITIVE_INFINITY });
    controller.setHighlights([{
        kind: `cell`,
        cells: [{ x: 0, y: 0 }],
        color: `#fff`,
    }]);
    assert.equal(Number.isFinite(controller.getViewState().scale), true);

    controller.resetView();

    assert.deepEqual(controller.getEmphasizedCells(), [{ x: 2, y: -1 }]);
    assert.equal(controller.getHighlights().length, 1);
    assert.equal(controller.getViewState().offsetX, 0);
});
