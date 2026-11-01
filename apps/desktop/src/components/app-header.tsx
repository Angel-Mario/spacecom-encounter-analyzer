import { Select, Text } from "@fluentui/react-components";

import spacecomLogo from "../assets/spacecom-logo.svg";
import { localeOptions } from "../i18n";
import type { Locale, LocaleCopy } from "../i18n";

interface AppHeaderProps {
  copy: LocaleCopy;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

const AppHeader = ({ copy, locale, onLocaleChange }: AppHeaderProps) => (
  <header className="app-header">
    <div className="app-brand">
      <img alt="Spacecom" className="brand-mark" src={spacecomLogo} />
      <div className="brand-copy">
        <Text as="h1" size={500} weight="semibold">
          Spacecom Encounter Analyzer
        </Text>
        <Text as="p" size={300}>
          {copy.appSubtitle}
        </Text>
      </div>
    </div>
    <Select
      aria-label={copy.language}
      onChange={(_, data) => {
        if (data.value === "en" || data.value === "es" || data.value === "pt") {
          onLocaleChange(data.value);
        }
      }}
      size="small"
      value={locale}
    >
      {localeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  </header>
);

export default AppHeader;
