import { Badge, Text } from "@fluentui/react-components";
import {
  CalendarLtrRegular,
  LocationRegular,
  PeopleRegular,
  RulerRegular,
} from "@fluentui/react-icons";

import type { LocaleCopy } from "../i18n";

interface EncounterDetailsPanelProps {
  copy: LocaleCopy;
}

const EncounterDetailsPanel = ({ copy }: EncounterDetailsPanelProps) => (
  <div
    id="details-panel"
    aria-labelledby="details-tab"
    className="workspace-view encounter-details-view"
    role="tabpanel"
    tabIndex={0}
  >
    <div className="details-heading">
      <div>
        <Text as="h2" size={400} weight="bold">
          {copy.encounterDetails}
        </Text>
        <Text size={200}>{copy.chooseResult}</Text>
      </div>
      <Badge appearance="tint">{copy.noSelection}</Badge>
    </div>

    <div className="details-empty">
      <div className="details-empty-icon">
        <LocationRegular />
      </div>
      <Text as="h3" size={400} weight="semibold">
        {copy.selectEncounter}
      </Text>
      <Text size={200}>{copy.encounterDataWillAppear}</Text>
    </div>

    <dl className="encounter-fields">
      <div>
        <dt>
          <PeopleRegular />
          {copy.monitors}
        </dt>
        <dd>—</dd>
      </div>
      <div>
        <dt>
          <CalendarLtrRegular />
          {copy.timestamp}
        </dt>
        <dd>—</dd>
      </div>
      <div>
        <dt>
          <RulerRegular />
          {copy.distance}
        </dt>
        <dd>—</dd>
      </div>
    </dl>
  </div>
);

export default EncounterDetailsPanel;
