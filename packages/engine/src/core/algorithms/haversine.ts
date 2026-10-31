import type { Coordinates } from "../../domain.js";

// Raio da Terra em metros, conforme especificado pelo desafio.
export const EARTH_RADIUS_METERS = 6_371_000;

// Converte um ângulo de graus para radianos.
const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

// Calcula a distância em metros entre dois pontos geográficos usando a fórmula de Haversine.
// A fórmula é exata para a superfície de uma esfera; a diferença para o elipsoide terrestre real
// é irrelevante na escala de 20 metros usada pelo desafio.
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
