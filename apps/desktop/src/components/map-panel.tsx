import { Badge, Text } from "@fluentui/react-components";
import { LocationRegular, MapRegular, ZoomInRegular, ZoomOutRegular } from "@fluentui/react-icons";

import type { LocaleCopy } from "../i18n";

interface MapPanelProps {
  copy: LocaleCopy;
}

const MapPanel = ({ copy }: MapPanelProps) => (
  <div
    id="map-panel"
    aria-labelledby="map-tab"
    className="workspace-view map-view"
    role="tabpanel"
    tabIndex={0}
  >
    <div className="map-view-heading">
      <div>
        <Text as="h2" size={400} weight="semibold">
          {copy.mapHeading}
        </Text>
        <Text size={200}>{copy.mapDescription}</Text>
      </div>
      <Badge appearance="tint" icon={<MapRegular />}>
        {copy.noPoints}
      </Badge>
    </div>
    <div className="map-canvas" aria-label={copy.mapWithoutData}>
      <div className="map-road road-horizontal road-one" />
      <div className="map-road road-horizontal road-two" />
      <div className="map-road road-horizontal road-three" />
      <div className="map-road road-vertical road-four" />
      <div className="map-road road-vertical road-five" />
      <div className="map-river" />
      <div className="map-controls" aria-hidden="true">
        <span>
          <ZoomInRegular />
        </span>
        <span>
          <ZoomOutRegular />
        </span>
      </div>
      <div className="map-empty">
        <div className="map-empty-illustration">
          <div className="map-tile">
            <LocationRegular className="map-pin map-pin-primary" />
            <LocationRegular className="map-pin map-pin-secondary" />
            <span className="map-route" />
          </div>
        </div>
        <Text as="h3" size={400} weight="bold">
          {copy.noMapResults}
        </Text>
        <Text size={200}>{copy.importToVisualize}</Text>
      </div>
    </div>
  </div>
);

export default MapPanel;
