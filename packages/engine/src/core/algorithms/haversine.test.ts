import { describe, expect, it } from "vitest";
import { EARTH_RADIUS_METERS, calculateDistanceMeters } from "./haversine.js";

describe("calculateDistanceMeters", () => {
  it("returns zero for the same coordinates", () => {
    const position = { lat: -23.55052, lon: -46.63331 };

    expect(calculateDistanceMeters(position, position)).toBe(0);
  });

  it("matches the challenge example using Earth's specified radius", () => {
    const first = { lat: -10.07996, lon: -37.08384 };
    const second = { lat: -10.07987, lon: -37.08389 };

    expect(calculateDistanceMeters(first, second)).toBeCloseTo(11.406788673336607, 10);
  });

  it("returns the same distance regardless of argument order", () => {
    const first = { lat: 40.7128, lon: -74.006 };
    const second = { lat: 34.0522, lon: -118.2437 };

    expect(calculateDistanceMeters(first, second)).toBe(calculateDistanceMeters(second, first));
  });

  it("handles antipodal coordinates without producing an invalid result", () => {
    const first = { lat: 0, lon: 0 };
    const antipode = { lat: 0, lon: 180 };

    expect(calculateDistanceMeters(first, antipode)).toBeCloseTo(Math.PI * EARTH_RADIUS_METERS, 8);
  });
});
