import { Badge, Text } from "@fluentui/react-components";
import { LocationRegular, PlayFilled } from "@fluentui/react-icons";

import type { LocaleCopy } from "../i18n";

interface OverviewBannerProps {
  copy: LocaleCopy;
}

const OverviewBanner = ({ copy }: OverviewBannerProps) => (
  <section className="overview-banner">
    <div className="banner-copy">
      <Badge appearance="tint" className="banner-kicker">
        <LocationRegular />
        {copy.bannerKicker}
      </Badge>
      <Text as="h2" size={500} weight="bold">
        {copy.bannerHeading}
      </Text>
      <Text as="p" size={300}>
        {copy.bannerDescription}
      </Text>
      <Text className="banner-footnote" size={200}>
        <PlayFilled className="banner-footnote-icon" />
        {copy.bannerImportPrompt}
      </Text>
    </div>
  </section>
);

export default OverviewBanner;
