/**
 * Tests de la partie « vue » qui ne dépend pas du navigateur :
 * conversions de la caméra et tracé de lignes (Bresenham).
 */
import { describe, expect, it } from 'vitest';
import { cellsOnLine } from '../src/input/line';
import { Camera, sliderToValue, valueToSlider } from '../src/render/camera';

describe('Caméra', () => {
  it('écran → monde → écran redonne le même point', () => {
    const camera = new Camera();
    camera.setViewport(1200, 800);
    camera.centerX = 13.5;
    camera.centerY = -4.25;
    camera.zoom = 17;
    const world = camera.screenToWorld(321, 654);
    expect(camera.worldToScreenX(world.x)).toBeCloseTo(321);
    expect(camera.worldToScreenY(world.y)).toBeCloseTo(654);
  });

  it('zoomer garde fixe le point sous le curseur', () => {
    const camera = new Camera();
    camera.setViewport(1000, 700);
    const before = camera.screenToWorld(200, 150);
    camera.zoomAt(200, 150, 2.5);
    const after = camera.screenToWorld(200, 150);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('les curseurs logarithmiques sont réversibles', () => {
    for (const position of [0, 12.5, 50, 99]) {
      expect(valueToSlider(sliderToValue(position, 0.25, 96), 0.25, 96)).toBeCloseTo(position);
    }
  });
});

describe('Ligne de Bresenham', () => {
  it('relie les deux extrémités par des cases qui se touchent', () => {
    const cells: Array<[number, number]> = [];
    cellsOnLine(-3, 2, 9, -5, (x, y) => cells.push([x, y]));
    expect(cells[0]).toEqual([-3, 2]);
    expect(cells[cells.length - 1]).toEqual([9, -5]);
    for (let i = 1; i < cells.length; i++) {
      const [ax, ay] = cells[i - 1] as [number, number];
      const [bx, by] = cells[i] as [number, number];
      expect(Math.max(Math.abs(bx - ax), Math.abs(by - ay))).toBe(1); // voisines (même en diagonale)
    }
  });
});
