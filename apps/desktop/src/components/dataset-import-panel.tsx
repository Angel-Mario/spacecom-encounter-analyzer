import { Badge, Button, Card, Text } from "@fluentui/react-components";
import {
  ArrowUploadRegular,
  DeleteRegular,
  DocumentRegular,
  FolderOpenRegular,
} from "@fluentui/react-icons";
import { useRef } from "react";
import type { ChangeEvent, DragEvent } from "react";

import type { LocaleCopy, UploadMessage } from "../i18n";
import { formatFileSize, getFileKey } from "../utils/file-utils";

interface DatasetImportPanelProps {
  copy: LocaleCopy;
  files: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (file: File) => void;
  uploadMessage: UploadMessage;
}

const getUploadMessage = (copy: LocaleCopy, uploadMessage: UploadMessage): string => {
  if (uploadMessage === "invalid") {
    return copy.invalidFileSelection;
  }

  if (uploadMessage === "ignored") {
    return copy.ignoredFiles;
  }

  if (uploadMessage === "updated") {
    return copy.filesUpdated;
  }

  return "";
};

const DatasetImportPanel = ({
  copy,
  files,
  onAddFiles,
  onRemoveFile,
  uploadMessage,
}: DatasetImportPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onAddFiles([...(event.currentTarget.files ?? [])]);
    event.currentTarget.value = "";
  };

  const handleFileDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    onAddFiles([...event.dataTransfer.files]);
  };

  return (
    <Card className="panel import-panel">
      <div className="panel-heading">
        <span className="step-number">1</span>
        <Text as="h2" weight="bold">
          {copy.importHeading}
        </Text>
        <Badge appearance="tint" className="panel-count">
          {files.length}
        </Badge>
      </div>

      <section
        aria-label={copy.dropAreaLabel}
        className="drop-area"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleFileDrop}
      >
        <ArrowUploadRegular aria-hidden="true" className="drop-icon" />
        <Text className="drop-title" weight="semibold">
          {copy.dropTitle}
        </Text>
        <Text className="drop-subtitle">{copy.dropSubtitle}</Text>
        <Text className="drop-hint">
          <DocumentRegular aria-hidden="true" />
          {copy.acceptedFiles}
        </Text>
        <Button
          appearance="primary"
          icon={<FolderOpenRegular />}
          onClick={() => fileInputRef.current?.click()}
        >
          {copy.selectFiles}
        </Button>
        <input
          ref={fileInputRef}
          accept=".txt,text/plain"
          aria-label={copy.selectFilesAria}
          className="visually-hidden"
          multiple
          onChange={handleFileInputChange}
          type="file"
        />
      </section>

      <div className="file-list" aria-live="polite">
        {files.length === 0 ? (
          <Text className="file-list-empty" size={200}>
            {getUploadMessage(copy, uploadMessage) || copy.emptyFiles}
          </Text>
        ) : (
          <>
            <div className="file-list-heading">
              <Text size={200} weight="semibold">
                {copy.loadedFiles}
              </Text>
              <Text size={100}>{getUploadMessage(copy, uploadMessage)}</Text>
            </div>
            <ul className="dataset-list">
              {files.map((file) => (
                <li className="dataset-item" key={getFileKey(file)}>
                  <DocumentRegular aria-hidden="true" />
                  <span className="dataset-name" title={file.name}>
                    {file.name}
                  </span>
                  <Text size={100}>{formatFileSize(file.size)}</Text>
                  <Button
                    appearance="subtle"
                    aria-label={copy.removeFile(file.name)}
                    icon={<DeleteRegular />}
                    onClick={() => onRemoveFile(file)}
                    size="small"
                    title={copy.removeFile(file.name)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
};

export default DatasetImportPanel;
