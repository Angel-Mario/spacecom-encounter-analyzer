import {
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Text,
} from "@fluentui/react-components";
import {
  CheckmarkRegular,
  DismissRegular,
  GlobeRegular,
  SquareMultipleRegular,
  SquareRegular,
  SubtractRegular,
} from "@fluentui/react-icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";

import spacecomLogo from "../assets/spacecom-logo.svg";
import { localeOptions } from "../i18n";
import type { Locale, LocaleCopy } from "../i18n";

interface AppHeaderProps {
  copy: LocaleCopy;
  isDesktopApp: boolean;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

const AppHeader = ({ copy, isDesktopApp, locale, onLocaleChange }: AppHeaderProps) => {
  const appWindow = useMemo(() => (isDesktopApp ? getCurrentWindow() : null), [isDesktopApp]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowError, setWindowError] = useState("");

  useEffect(() => {
    if (!appWindow) {
      return;
    }

    let disposed = false;
    let resizeTimeout: number | undefined;
    let unlisten: (() => void) | undefined;

    const syncMaximizedState = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        if (!disposed) {
          setIsMaximized(maximized);
        }
      } catch {
        if (!disposed) {
          setWindowError(copy.windowActionFailed);
        }
      }
    };

    const initializeWindowState = async () => {
      await syncMaximizedState();

      try {
        const stopListening = await appWindow.onResized(() => {
          if (resizeTimeout !== undefined) {
            window.clearTimeout(resizeTimeout);
          }
          resizeTimeout = window.setTimeout(syncMaximizedState, 100);
        });

        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
        }
      } catch {
        if (!disposed) {
          setWindowError(copy.windowActionFailed);
        }
      }
    };

    initializeWindowState();

    return () => {
      disposed = true;
      unlisten?.();
      if (resizeTimeout !== undefined) {
        window.clearTimeout(resizeTimeout);
      }
    };
  }, [appWindow, copy.windowActionFailed]);

  const handleWindowAction = async (action: "close" | "maximize" | "minimize") => {
    if (!appWindow) {
      return;
    }

    try {
      if (action === "close") {
        await appWindow.close();
        return;
      }
      if (action === "minimize") {
        await appWindow.minimize();
        return;
      }

      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    } catch {
      setWindowError(copy.windowActionFailed);
    }
  };

  const handleWindowDrag = async (event: MouseEvent<HTMLElement>) => {
    if (
      !appWindow ||
      event.button !== 0 ||
      (event.target instanceof Element &&
        event.target.closest(".header-actions, .window-controls, button"))
    ) {
      return;
    }

    try {
      await appWindow.startDragging();
    } catch {
      setWindowError(copy.windowActionFailed);
    }
  };

  return (
    <header className={`app-header${appWindow ? " is-draggable" : ""}`}>
      <div className="app-brand" onMouseDown={handleWindowDrag}>
        <img alt="Spacecom" className="brand-mark" src={spacecomLogo} />
        <div className="brand-copy">
          <Text as="h1" size={500} weight="bold">
            Spacecom Encounter Analyzer
          </Text>
          <Text as="p" size={300}>
            {copy.appSubtitle}
          </Text>
        </div>
      </div>
      <div aria-hidden="true" className="header-drag-space" onMouseDown={handleWindowDrag} />
      <div className="header-actions">
        {windowError ? (
          <Text className="window-controls-error" role="alert" size={100}>
            {windowError}
          </Text>
        ) : null}
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <MenuButton
              aria-label={copy.language}
              appearance="subtle"
              className="language-menu-button"
              icon={<GlobeRegular />}
              size="small"
              title={copy.language}
            >
              {locale.toUpperCase()}
            </MenuButton>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {localeOptions.map((option) => (
                <MenuItem
                  icon={locale === option.value ? <CheckmarkRegular /> : undefined}
                  key={option.value}
                  onClick={() => onLocaleChange(option.value)}
                >
                  {option.label}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
        {appWindow ? (
          <div aria-label={copy.windowControls} className="window-controls" role="group">
            <Button
              aria-label={copy.minimizeWindow}
              appearance="transparent"
              className="window-control"
              icon={<SubtractRegular />}
              onClick={async () => {
                await handleWindowAction("minimize");
              }}
              title={copy.minimizeWindow}
            />
            <Button
              aria-label={isMaximized ? copy.restoreWindow : copy.maximizeWindow}
              appearance="transparent"
              className="window-control"
              icon={isMaximized ? <SquareMultipleRegular /> : <SquareRegular />}
              onClick={async () => {
                await handleWindowAction("maximize");
              }}
              title={isMaximized ? copy.restoreWindow : copy.maximizeWindow}
            />
            <Button
              aria-label={copy.closeWindow}
              appearance="transparent"
              className="window-control window-control-close"
              icon={<DismissRegular />}
              onClick={async () => {
                await handleWindowAction("close");
              }}
              title={copy.closeWindow}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default AppHeader;
