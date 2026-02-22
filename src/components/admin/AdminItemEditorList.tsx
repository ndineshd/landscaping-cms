"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemEditorComponent } from "@/components/admin/ItemEditorComponent";
import type { DataItem, DynamicField } from "@/types/cms";

const ADMIN_CONFIG_LANGUAGE_EDITABLE_ROOT_PATHS = ["hero", "about", "contact"];
const ADMIN_CONFIG_LANGUAGE_EDITABLE_FIELD_PATH_PREFIXES = [
  "hero",
  "about",
  "contact",
  "site.companyName",
  "site.tagline",
  "site.description",
  "seo.title",
  "seo.description",
];

interface SiteConfigSection {
  key: string;
  label: string;
}

interface AdminItemEditorListProps {
  items: DataItem[];
  fields: DynamicField[];
  password: string;
  isLoading: boolean;
  canAddTopLevelItems: boolean;
  isSiteConfigFile: boolean;
  siteConfigItem: DataItem | null;
  siteConfigLocalId: string | null;
  siteConfigSections: SiteConfigSection[];
  siteConfigHiddenFieldPaths: string[];
  isAutoIdFile: boolean;
  activeLanguageCode: string;
  defaultLanguageCode: string;
  allLanguageCodes: string[];
  isLanguageEditableFile: boolean;
  allowProjectGalleryVideo: boolean;
  onAddItem: () => void;
  onUpdateItemField: (
    localItemId: string,
    fieldPath: (string | number)[],
    value: unknown
  ) => void;
  onImageUpload: (
    localItemId: string,
    fieldPath: (string | number)[],
    file: File,
    currentValue?: string
  ) => void;
  onImageRemove: (
    localItemId: string,
    fieldPath: (string | number)[],
    currentValue?: string
  ) => void;
  onDeleteItem: (localItemId: string) => void;
}

function resolveLocalItemId(item: DataItem): string {
  if (typeof item.__localId === "string" && item.__localId) return item.__localId;
  return String(item.id);
}

export function AdminItemEditorList({
  items,
  fields,
  password,
  isLoading,
  canAddTopLevelItems,
  isSiteConfigFile,
  siteConfigItem,
  siteConfigLocalId,
  siteConfigSections,
  siteConfigHiddenFieldPaths,
  isAutoIdFile,
  activeLanguageCode,
  defaultLanguageCode,
  allLanguageCodes,
  isLanguageEditableFile,
  allowProjectGalleryVideo,
  onAddItem,
  onUpdateItemField,
  onImageUpload,
  onImageRemove,
  onDeleteItem,
}: AdminItemEditorListProps) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50">
        <p className="text-sm text-slate-600 mb-4">No records found for this file yet.</p>
        {canAddTopLevelItems && (
          <Button onClick={onAddItem} disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Create First Item
          </Button>
        )}
      </div>
    );
  }

  if (isSiteConfigFile && siteConfigItem && siteConfigLocalId) {
    return (
      <>
        {siteConfigSections.map((section) => (
          <div key={`${siteConfigLocalId}-${section.key}`} className="border p-3 rounded-md bg-gray-50">
            <ItemEditorComponent
              item={siteConfigItem}
              fields={fields}
              password={password}
              disabled={isLoading}
              autoIdFromContent={false}
              activeLanguageCode={activeLanguageCode}
              defaultLanguageCode={defaultLanguageCode}
              availableLanguageCodes={allLanguageCodes}
              enableLanguageEditing={isLanguageEditableFile}
              allowProjectGalleryVideo={allowProjectGalleryVideo}
              languageEditableRootPaths={ADMIN_CONFIG_LANGUAGE_EDITABLE_ROOT_PATHS}
              languageEditablePathPrefixes={ADMIN_CONFIG_LANGUAGE_EDITABLE_FIELD_PATH_PREFIXES}
              hiddenFieldPaths={siteConfigHiddenFieldPaths}
              filterFieldNames={[section.key]}
              titleOverride={section.label}
              hideDeleteAction
              defaultExpanded={false}
              onFieldChange={(fieldPath, value) =>
                onUpdateItemField(siteConfigLocalId, fieldPath, value)
              }
              onImageUpload={(fieldPath, file, currentValue) =>
                onImageUpload(siteConfigLocalId, fieldPath, file, currentValue)
              }
              onImageRemove={(fieldPath, currentValue) =>
                onImageRemove(siteConfigLocalId, fieldPath, currentValue)
              }
              onDelete={() => {}}
            />
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {items.map((item) => {
        const localItemId = resolveLocalItemId(item);

        return (
          <div key={localItemId} className="border p-3 rounded-md bg-gray-50">
            <ItemEditorComponent
              item={item}
              fields={fields}
              password={password}
              disabled={isLoading}
              autoIdFromContent={isAutoIdFile}
              activeLanguageCode={activeLanguageCode}
              defaultLanguageCode={defaultLanguageCode}
              availableLanguageCodes={allLanguageCodes}
              enableLanguageEditing={isLanguageEditableFile}
              allowProjectGalleryVideo={allowProjectGalleryVideo}
              onFieldChange={(fieldPath, value) => onUpdateItemField(localItemId, fieldPath, value)}
              onImageUpload={(fieldPath, file, currentValue) =>
                onImageUpload(localItemId, fieldPath, file, currentValue)
              }
              onImageRemove={(fieldPath, currentValue) =>
                onImageRemove(localItemId, fieldPath, currentValue)
              }
              onDelete={() => onDeleteItem(localItemId)}
            />
          </div>
        );
      })}
    </>
  );
}
