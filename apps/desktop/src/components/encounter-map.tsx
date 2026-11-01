import { Button } from "@fluentui/react-components";
import { ArrowResetRegular } from "@fluentui/react-icons";
import type {
  GeoJSONSource as MapLibreGeoJSONSource,
  Map as MapLibreMap,
  Popup as MapLibrePopup,
} from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef, useState } from "react";

import type { LocaleCopy } from "../i18n";
import type { EncounterType } from "../types";

import "maplibre-gl/dist/maplibre-gl.css";

interface EncounterMapPoint {
  encounterIndex: number;
  encounterType: EncounterType;
  lat: number;
  lon: number;
  monitorIds: string;
  timestamp: string;
  distanceMeters: number;
  displayIndex: number;
}

interface EncounterMapProps {
  copy: LocaleCopy;
  points: EncounterMapPoint[];
  selectedEncounterIndex: number | undefined;
  onSelectEncounter: (encounterIndex: number) => void;
}

const MAP_STYLE_URL = "https://demotiles.maplibre.org/style.json";
const ENCOUNTER_SOURCE_ID = "encounters";
const ENCOUNTER_LAYER_ID = "encounter-points";
const ENCOUNTER_LABEL_LAYER_ID = "encounter-labels";

const createGeoJson = (
  points: EncounterMapPoint[],
  selectedEncounterIndex: number | undefined,
) => ({
  features: points.map((point) => ({
    geometry: {
      coordinates: [point.lon, point.lat] as [number, number],
      type: "Point" as const,
    },
    id: point.encounterIndex,
    properties: {
      displayIndex: point.displayIndex,
      encounterIndex: point.encounterIndex,
      encounterType: point.encounterType,
      selected: point.encounterIndex === selectedEncounterIndex,
    },
    type: "Feature" as const,
  })),
  type: "FeatureCollection" as const,
});

const fitPoints = (map: MapLibreMap, points: EncounterMapPoint[]) => {
  if (points.length === 0) {
    return;
  }

  if (points.length === 1) {
    const [point] = points;
    if (point) {
      map.easeTo({ center: [point.lon, point.lat], duration: 0, zoom: 14 });
    }
    return;
  }

  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    west = Math.min(west, point.lon);
    east = Math.max(east, point.lon);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
  }

  if (west === east && south === north) {
    map.easeTo({
      center: [west, south],
      duration: 0,
      zoom: 14,
    });
    return;
  }

  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    { duration: 0, maxZoom: 14, padding: 48 },
  );
};

const getEncounterIndex = (properties: unknown): number | undefined => {
  if (typeof properties !== "object" || properties === null) {
    return undefined;
  }

  const encounterIndex = "encounterIndex" in properties ? properties.encounterIndex : undefined;
  return typeof encounterIndex === "number" ? encounterIndex : undefined;
};

const isGeoJSONSource = (source: unknown): source is MapLibreGeoJSONSource =>
  typeof source === "object" &&
  source !== null &&
  "type" in source &&
  source.type === "geojson" &&
  "setData" in source &&
  typeof source.setData === "function";

const createPopupContent = (copy: LocaleCopy, point: EncounterMapPoint): HTMLElement => {
  const content = document.createElement("div");
  content.className = "encounter-map-popup-content";

  let encounterTypeLabel = copy.generic;
  if (point.encounterType === "faccao") {
    encounterTypeLabel = copy.faction;
  } else if (point.encounterType === "protetiva") {
    encounterTypeLabel = copy.protective;
  }

  const encounterType = document.createElement("strong");
  encounterType.textContent = encounterTypeLabel;
  content.append(encounterType);

  const monitors = document.createElement("strong");
  monitors.textContent = `${copy.monitors}: ${point.monitorIds}`;
  content.append(monitors);

  const timestamp = document.createElement("span");
  timestamp.textContent = `${copy.timestamp}: ${point.timestamp}`;
  content.append(timestamp);

  const distance = document.createElement("span");
  distance.textContent = `${copy.distanceMeters}: ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(point.distanceMeters)} m`;
  content.append(distance);

  const coordinates = document.createElement("span");
  coordinates.textContent = `${copy.latitude}: ${point.lat.toFixed(5)} · ${copy.longitude}: ${point.lon.toFixed(5)}`;
  content.append(coordinates);

  return content;
};

const EncounterMap = ({
  copy,
  points,
  selectedEncounterIndex,
  onSelectEncounter,
}: EncounterMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pointsRef = useRef(points);
  const copyRef = useRef(copy);
  const selectedEncounterIndexRef = useRef(selectedEncounterIndex);
  const onSelectEncounterRef = useRef(onSelectEncounter);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    pointsRef.current = points;
    copyRef.current = copy;
    selectedEncounterIndexRef.current = selectedEncounterIndex;
    onSelectEncounterRef.current = onSelectEncounter;
  }, [copy, onSelectEncounter, points, selectedEncounterIndex]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let disposed = false;
    let map: MapLibreMap | null = null;
    let popup: MapLibrePopup | null = null;

    const initializeMap = async () => {
      try {
        const {
          Map: MapLibreMapClass,
          NavigationControl,
          Popup,
          ScaleControl,
          setWorkerUrl,
        } = await import("maplibre-gl");
        if (disposed || !containerRef.current) {
          return;
        }

        setWorkerUrl(mapLibreWorkerUrl);
        const currentMap = new MapLibreMapClass({
          center: [0, 0],
          container: containerRef.current,
          style: MAP_STYLE_URL,
          zoom: 2,
        });
        const currentPopup = new Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
        });
        map = currentMap;
        popup = currentPopup;
        mapRef.current = currentMap;
        currentMap.addControl(new NavigationControl({ showCompass: false }), "top-right");
        currentMap.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");

        currentMap.once("load", () => {
          currentMap.addSource(ENCOUNTER_SOURCE_ID, {
            data: createGeoJson(pointsRef.current, selectedEncounterIndexRef.current),
            type: "geojson",
          });
          currentMap.addLayer({
            id: ENCOUNTER_LAYER_ID,
            paint: {
              "circle-color": [
                "match",
                ["get", "encounterType"],
                "generico",
                "#d97706",
                "faccao",
                "#7354bb",
                "protetiva",
                "#16845b",
                "#c70008",
              ],
              "circle-opacity": 0.96,
              "circle-radius": ["case", ["boolean", ["get", "selected"], false], 10, 7],
              "circle-stroke-color": [
                "case",
                ["boolean", ["get", "selected"], false],
                "#fe040c",
                "#ffffff",
              ],
              "circle-stroke-width": ["case", ["boolean", ["get", "selected"], false], 3, 2],
            },
            source: ENCOUNTER_SOURCE_ID,
            type: "circle",
          });
          currentMap.addLayer({
            id: ENCOUNTER_LABEL_LAYER_ID,
            layout: {
              "text-allow-overlap": true,
              "text-field": ["to-string", ["get", "displayIndex"]],
              "text-ignore-placement": true,
              "text-size": 10,
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#32253a",
              "text-halo-width": 0.5,
            },
            source: ENCOUNTER_SOURCE_ID,
            type: "symbol",
          });
          setMapError(null);
          setIsMapLoaded(true);
        });

        currentMap.on("error", (event) => {
          if (!disposed && !currentMap.isStyleLoaded()) {
            setMapError(event.error.message);
          }
        });
        currentMap.on("mouseenter", ENCOUNTER_LAYER_ID, () => {
          currentMap.getCanvas().style.cursor = "pointer";
        });
        currentMap.on("mouseleave", ENCOUNTER_LAYER_ID, () => {
          currentMap.getCanvas().style.cursor = "";
          currentPopup.remove();
        });
        currentMap.on("mousemove", ENCOUNTER_LAYER_ID, (event) => {
          const feature = event.features?.[0];
          const encounterIndex = getEncounterIndex(feature?.properties);
          const point = pointsRef.current.find(
            (candidate) => candidate.encounterIndex === encounterIndex,
          );
          if (!point) {
            return;
          }

          currentPopup
            .setLngLat(event.lngLat)
            .setDOMContent(createPopupContent(copyRef.current, point))
            .addTo(currentMap);
        });
        currentMap.on("click", ENCOUNTER_LAYER_ID, (event) => {
          const encounterIndex = getEncounterIndex(event.features?.[0]?.properties);
          if (encounterIndex !== undefined) {
            onSelectEncounterRef.current(encounterIndex);
          }
        });
      } catch (error: unknown) {
        if (!disposed) {
          setMapError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void initializeMap();

    return () => {
      disposed = true;
      popup?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isMapLoaded) {
      return;
    }

    const source = mapRef.current?.getSource(ENCOUNTER_SOURCE_ID);
    if (isGeoJSONSource(source)) {
      source.setData(createGeoJson(points, selectedEncounterIndex));
    }
  }, [isMapLoaded, points, selectedEncounterIndex]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) {
      return;
    }
    fitPoints(mapRef.current, points);
  }, [isMapLoaded, points]);

  return (
    <div className="encounter-map-wrap">
      <div
        aria-label={copy.mapHeading}
        className="encounter-map"
        ref={containerRef}
        role="application"
      />
      {mapError ? (
        <div className="encounter-map-error" role="status">
          <span>{copy.mapLoadError}</span>
          <small>{mapError}</small>
        </div>
      ) : null}
      {!isMapLoaded && !mapError ? (
        <div className="encounter-map-loading" role="status">
          {copy.mapLoading}
        </div>
      ) : null}
      <Button
        aria-label={copy.resetMap}
        className="map-reset-control"
        icon={<ArrowResetRegular />}
        onClick={() => {
          const map = mapRef.current;
          if (map) {
            fitPoints(map, pointsRef.current);
          }
        }}
        size="small"
      />
    </div>
  );
};

export default EncounterMap;
