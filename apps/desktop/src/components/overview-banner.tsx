import { Badge, Text } from "@fluentui/react-components";
import { LocationRegular } from "@fluentui/react-icons";

import type { LocaleCopy } from "../i18n";

interface OverviewBannerProps {
  copy: LocaleCopy;
  fileCount: number;
}

const OverviewBanner = ({ copy, fileCount }: OverviewBannerProps) => (
  <section className="overview-banner">
    <div className="banner-copy">
      <Badge appearance="tint" className="banner-kicker">
        <LocationRegular />
        {copy.bannerKicker}
      </Badge>
      <Text as="h2" size={500} weight="semibold">
        {copy.bannerHeading}
      </Text>
      <Text as="p" size={300}>
        {copy.bannerDescription}
      </Text>
      <Text className="banner-footnote" size={200}>
        {fileCount > 0 ? copy.bannerFilesReady(fileCount) : copy.bannerImportPrompt}
      </Text>
    </div>
  </section>
);

export default OverviewBanner;
