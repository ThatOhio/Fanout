export const SEARCH_PROVIDERS = ['google', 'duckduckgo', 'brave', 'bing'] as const;
export const COLUMN_COUNTS = [2, 3, 4] as const;
export const WORKSPACE_PREFERENCES_STORAGE_KEY = 'fanout_workspace_preferences';
export const WORKSPACE_PREFERENCES_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_RESTORE_WARNING_MESSAGE =
  'Saved workspace settings could not be restored. Default settings were applied.';

export type SearchProvider = (typeof SEARCH_PROVIDERS)[number];
export type PersistedWorkspaceSettings = {
  darkMode: boolean;
  replaceAddressBarSearch: boolean;
};
export type PersistedWorkspaceProvidersByColumn = Record<number, SearchProvider>;
export type WorkspacePreferencesSnapshot = {
  columnCount: (typeof COLUMN_COUNTS)[number];
  providersByColumn: PersistedWorkspaceProvidersByColumn;
  settings: PersistedWorkspaceSettings;
};
export type PersistedWorkspacePreferencesV1 = WorkspacePreferencesSnapshot & {
  schemaVersion: typeof WORKSPACE_PREFERENCES_SCHEMA_VERSION;
};
export type WorkspacePreferencesStorageArea = {
  get: (keys: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string) => Promise<void>;
};
export type WorkspacePreferencesLoadResult = {
  preferences: PersistedWorkspacePreferencesV1;
  warning?: string;
  didLoadPersistedValue: boolean;
};

const DEFAULT_PROVIDERS_BY_COLUMN: PersistedWorkspaceProvidersByColumn = {
  1: 'google',
  2: 'duckduckgo',
  3: 'brave',
  4: 'bing',
};

export const DEFAULT_WORKSPACE_PREFERENCES: PersistedWorkspacePreferencesV1 = {
  schemaVersion: WORKSPACE_PREFERENCES_SCHEMA_VERSION,
  columnCount: 2,
  providersByColumn: { ...DEFAULT_PROVIDERS_BY_COLUMN },
  settings: {
    darkMode: true,
    replaceAddressBarSearch: false,
  },
};

type DecodeWorkspacePreferencesResult = {
  preferences: PersistedWorkspacePreferencesV1;
  warning?: string;
  shouldClear: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isColumnCount(value: unknown): value is (typeof COLUMN_COUNTS)[number] {
  return typeof value === 'number' && COLUMN_COUNTS.includes(value as (typeof COLUMN_COUNTS)[number]);
}

function isSearchProvider(value: unknown): value is SearchProvider {
  return typeof value === 'string' && (SEARCH_PROVIDERS as readonly string[]).includes(value);
}

function decodeProvidersByColumn(
  rawProvidersByColumn: unknown,
  columnCount: (typeof COLUMN_COUNTS)[number],
): PersistedWorkspaceProvidersByColumn | undefined {
  if (!isRecord(rawProvidersByColumn)) {
    return undefined;
  }

  const providersByColumn: PersistedWorkspaceProvidersByColumn = {};
  for (let columnIndex = 1; columnIndex <= 4; columnIndex += 1) {
    const rawProvider = rawProvidersByColumn[String(columnIndex)];
    if (columnIndex > columnCount) {
      providersByColumn[columnIndex] = DEFAULT_PROVIDERS_BY_COLUMN[columnIndex];
      continue;
    }

    if (!isSearchProvider(rawProvider)) {
      return undefined;
    }

    providersByColumn[columnIndex] = rawProvider;
  }

  return providersByColumn;
}

function decodeWorkspaceSettings(rawSettings: unknown): PersistedWorkspaceSettings | undefined {
  if (!isRecord(rawSettings)) {
    return undefined;
  }

  if (
    typeof rawSettings.darkMode !== 'boolean' ||
    typeof rawSettings.replaceAddressBarSearch !== 'boolean'
  ) {
    return undefined;
  }

  return {
    darkMode: rawSettings.darkMode,
    replaceAddressBarSearch: rawSettings.replaceAddressBarSearch,
  };
}

function buildRestoreWarningResult(): DecodeWorkspacePreferencesResult {
  return {
    preferences: { ...DEFAULT_WORKSPACE_PREFERENCES, providersByColumn: { ...DEFAULT_WORKSPACE_PREFERENCES.providersByColumn } },
    warning: WORKSPACE_RESTORE_WARNING_MESSAGE,
    shouldClear: true,
  };
}

export function decodeWorkspacePreferences(payload: unknown): DecodeWorkspacePreferencesResult {
  if (!isRecord(payload)) {
    return buildRestoreWarningResult();
  }

  if (payload.schemaVersion !== WORKSPACE_PREFERENCES_SCHEMA_VERSION) {
    return buildRestoreWarningResult();
  }

  if (!isColumnCount(payload.columnCount)) {
    return buildRestoreWarningResult();
  }

  const providersByColumn = decodeProvidersByColumn(payload.providersByColumn, payload.columnCount);
  if (!providersByColumn) {
    return buildRestoreWarningResult();
  }

  const settings = decodeWorkspaceSettings(payload.settings);
  if (!settings) {
    return buildRestoreWarningResult();
  }

  return {
    preferences: {
      schemaVersion: WORKSPACE_PREFERENCES_SCHEMA_VERSION,
      columnCount: payload.columnCount,
      providersByColumn,
      settings,
    },
    warning: undefined,
    shouldClear: false,
  };
}

export function getWorkspacePreferencesStorageArea(): WorkspacePreferencesStorageArea | undefined {
  const runtimeGlobal = globalThis as typeof globalThis & {
    browser?: {
      storage?: {
        local?: WorkspacePreferencesStorageArea;
      };
    };
    chrome?: {
      storage?: {
        local?: WorkspacePreferencesStorageArea;
      };
    };
  };

  return runtimeGlobal.browser?.storage?.local ?? runtimeGlobal.chrome?.storage?.local;
}

export async function loadWorkspacePreferences(
  storageArea = getWorkspacePreferencesStorageArea(),
): Promise<WorkspacePreferencesLoadResult> {
  const fallbackPreferences = {
    ...DEFAULT_WORKSPACE_PREFERENCES,
    providersByColumn: { ...DEFAULT_WORKSPACE_PREFERENCES.providersByColumn },
  };

  if (!storageArea) {
    return {
      preferences: fallbackPreferences,
      warning: undefined,
      didLoadPersistedValue: false,
    };
  }

  try {
    const storageResult = await storageArea.get(WORKSPACE_PREFERENCES_STORAGE_KEY);
    const storedPayload = storageResult[WORKSPACE_PREFERENCES_STORAGE_KEY];
    if (storedPayload === undefined) {
      return {
        preferences: fallbackPreferences,
        warning: undefined,
        didLoadPersistedValue: false,
      };
    }

    const decoded = decodeWorkspacePreferences(storedPayload);
    if (decoded.shouldClear) {
      await storageArea.remove(WORKSPACE_PREFERENCES_STORAGE_KEY);
    }

    return {
      preferences: decoded.preferences,
      warning: decoded.warning,
      didLoadPersistedValue: true,
    };
  } catch {
    return {
      preferences: fallbackPreferences,
      warning: WORKSPACE_RESTORE_WARNING_MESSAGE,
      didLoadPersistedValue: false,
    };
  }
}

export async function saveWorkspacePreferences(
  preferences: WorkspacePreferencesSnapshot,
  storageArea = getWorkspacePreferencesStorageArea(),
): Promise<void> {
  if (!storageArea) {
    return;
  }

  const normalizedProvidersByColumn: PersistedWorkspaceProvidersByColumn = {
    1: preferences.providersByColumn[1] ?? DEFAULT_PROVIDERS_BY_COLUMN[1],
    2: preferences.providersByColumn[2] ?? DEFAULT_PROVIDERS_BY_COLUMN[2],
    3: preferences.providersByColumn[3] ?? DEFAULT_PROVIDERS_BY_COLUMN[3],
    4: preferences.providersByColumn[4] ?? DEFAULT_PROVIDERS_BY_COLUMN[4],
  };

  const payload: PersistedWorkspacePreferencesV1 = {
    schemaVersion: WORKSPACE_PREFERENCES_SCHEMA_VERSION,
    columnCount: preferences.columnCount,
    providersByColumn: normalizedProvidersByColumn,
    settings: {
      darkMode: preferences.settings.darkMode,
      replaceAddressBarSearch: preferences.settings.replaceAddressBarSearch,
    },
  };

  try {
    await storageArea.set({
      [WORKSPACE_PREFERENCES_STORAGE_KEY]: payload,
    });
  } catch {
    // Storage quota or runtime errors must not break the workspace UI.
  }
}
