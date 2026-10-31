import type { Coordinates } from "../../domain.js";

export const EARTH_RADIUS_METERS = 6_371_000;

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

// Converte coordenadas geográficas de graus para radianos.
export const calculateDistanceMeters = (first: Coordinates, second: Coordinates): number => {
  const firstLatitude = degreesToRadians(first.lat);
  const secondLatitude = degreesToRadians(second.lat);
  const latitudeDifference = degreesToRadians(second.lat - first.lat);
  const longitudeDifference = degreesToRadians(second.lon - first.lon);

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDifference / 2) ** 2;
  // Evita erro numérico quando pontos muito distantes resultam em valor ligeiramente acima de 1.
  const centralAngle = 2 * Math.atan2(Math.sqrt(Math.min(1, haversine)), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_METERS * centralAngle;
};
