"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LanguageOption } from "@/lib/language-utils";

interface LanguageSettingsCardProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  defaultLanguageCode: string;
  activeLanguageCode: string;
  editableLanguageCodes: string[];
  availableLanguageCodes: string[];
  languageOptions: LanguageOption[];
  newLanguageName: string;
  newLanguageCode: string;
  onNewLanguageNameChange: (value: string) => void;
  onNewLanguageCodeChange: (value: string) => void;
  onDefaultLanguageChange: (languageCode: string) => void;
  onActiveLanguageChange: (languageCode: string) => void;
  onToggleActiveLanguage: (languageCode: string) => void;
  onRemoveLanguage: (languageCode: string) => void;
  onUpdateLanguageName: (languageCode: string, nextName: string) => void;
  onAddLanguage: () => void;
  getLanguageName: (languageCode: string) => string;
}

export function LanguageSettingsCard({
  isExpanded,
  onToggleExpanded,
  defaultLanguageCode,
  activeLanguageCode,
  editableLanguageCodes,
  availableLanguageCodes,
  languageOptions,
  newLanguageName,
  newLanguageCode,
  onNewLanguageNameChange,
  onNewLanguageCodeChange,
  onDefaultLanguageChange,
  onActiveLanguageChange,
  onToggleActiveLanguage,
  onRemoveLanguage,
  onUpdateLanguageName,
  onAddLanguage,
  getLanguageName,
}: LanguageSettingsCardProps) {
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    languageOptions.forEach((language) => {
      nextDrafts[language.code] = language.name;
    });
    setNameDrafts(nextDrafts);
  }, [languageOptions]);

  const commitLanguageName = (languageCode: string) => {
    const current = languageOptions.find((language) => language.code === languageCode);
    if (!current) return;

    const draftValue = (nameDrafts[languageCode] || "").trim();
    if (!draftValue) {
      setNameDrafts((prev) => ({ ...prev, [languageCode]: current.name }));
      return;
    }
    if (draftValue === current.name) return;

    onUpdateLanguageName(languageCode, draftValue);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Languages className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Language Settings</h3>
            <p className="text-xs text-slate-500">Add, remove, and activate site languages.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleExpanded}
          className="h-8 px-2 text-xs"
        >
          {isExpanded ? "Collapse" : "Expand"}
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {isExpanded && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Default Language</label>
              <select
                value={defaultLanguageCode}
                onChange={(e) => onDefaultLanguageChange(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {languageOptions.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Active Language Selector</label>
              <select
                value={activeLanguageCode}
                onChange={(e) => onActiveLanguageChange(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {editableLanguageCodes.map((languageCode) => (
                  <option key={languageCode} value={languageCode}>
                    {getLanguageName(languageCode)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Language code is locked after creation. You can edit only the label.
          </p>
          <p className="text-xs text-slate-500">
            New languages are auto-filled using Google Translate. Review and edit after adding.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            {languageOptions.map((language) => {
              const canRemove = language.code !== defaultLanguageCode && language.code !== "en";
              return (
                <div
                  key={language.code}
                  className="flex items-center justify-between gap-3 rounded-md bg-white border border-slate-200 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <label className="text-xs font-medium text-slate-600">Label</label>
                    <input
                      type="text"
                      value={nameDrafts[language.code] ?? language.name}
                      onChange={(e) =>
                        setNameDrafts((prev) => ({
                          ...prev,
                          [language.code]: e.target.value,
                        }))
                      }
                      onBlur={() => commitLanguageName(language.code)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        (e.target as HTMLInputElement).blur();
                      }}
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <div className="mt-1 text-[11px] text-slate-500 uppercase">
                      Code: {language.code}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={availableLanguageCodes.includes(language.code)}
                        onChange={() => onToggleActiveLanguage(language.code)}
                      />
                      Active
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveLanguage(language.code)}
                      disabled={!canRemove}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr,140px,120px] gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Language Name</label>
              <input
                type="text"
                value={newLanguageName}
                onChange={(e) => onNewLanguageNameChange(e.target.value)}
                placeholder="Telugu"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Language Code</label>
              <input
                type="text"
                value={newLanguageCode}
                onChange={(e) => onNewLanguageCodeChange(e.target.value)}
                placeholder="tel"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm lowercase"
              />
            </div>
            <Button onClick={onAddLanguage} disabled={!newLanguageCode.trim()} className="h-10">
              Add Language
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
