import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  WORKSPACE_PREFERENCES_STORAGE_KEY,
  decodeWorkspacePreferences,
  loadWorkspacePreferences,
  saveWorkspacePreferences,
  type PersistedWorkspacePreferencesV1,
  type WorkspacePreferencesStorageArea,
} from './workspace-preferences-storage';

describe('workspace-preferences-storage', () => {
  it('decodes a valid v1 payload', () => {
    const payload: PersistedWorkspacePreferencesV1 = {
      schemaVersion: 1,
      columnCount: 3,
      providersByColumn: {
        1: 'google',
        2: 'bing',
        3: 'duckduckgo',
      },
      settings: {
        darkMode: false,        replaceAddressBarSearch: false,
      },
    };

    expect(decodeWorkspacePreferences(payload)).toEqual({
      preferences: {
        ...payload,
        providersByColumn: {
          ...payload.providersByColumn,
          4: 'bing',
        },
      },
      warning: undefined,
      shouldClear: false,
    });
  });

  it('returns fallback with warning for corrupt payload', () => {
    const result = decodeWorkspacePreferences({
      schemaVersion: 1,
      columnCount: 9,
      providersByColumn: {
        1: 'google',
      },
      settings: {
        darkMode: true,        replaceAddressBarSearch: false,
      },
    });

    expect(result.preferences).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(result.warning).toMatch(/could not be restored/i);
  });

  it('returns fallback with warning for unsupported schema version', () => {
    const result = decodeWorkspacePreferences({
      schemaVersion: 2,
      columnCount: 2,
      providersByColumn: {
        1: 'google',
        2: 'duckduckgo',
      },
      settings: {
        darkMode: true,        replaceAddressBarSearch: false,
      },
    });

    expect(result.preferences).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(result.warning).toMatch(/could not be restored/i);
  });

  it('loads fallback defaults without warning when storage area is unavailable', async () => {
    const result = await loadWorkspacePreferences(undefined);

    expect(result.preferences).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(result.warning).toBeUndefined();
    expect(result.didLoadPersistedValue).toBe(false);
  });

  it('loads fallback defaults without warning when payload is missing', async () => {
    const storageArea: WorkspacePreferencesStorageArea = {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn(),
      remove: vi.fn(),
    };

    const result = await loadWorkspacePreferences(storageArea);

    expect(storageArea.get).toHaveBeenCalledWith(WORKSPACE_PREFERENCES_STORAGE_KEY);
    expect(result.preferences).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(result.warning).toBeUndefined();
  });

  it('removes invalid payload and returns warning fallback', async () => {
    const storageArea: WorkspacePreferencesStorageArea = {
      get: vi.fn().mockResolvedValue({
        [WORKSPACE_PREFERENCES_STORAGE_KEY]: {
          schemaVersion: 1,
          columnCount: 4,
          providersByColumn: {
            1: 'google',
            2: 'duckduckgo',
            3: 'nope',
            4: 'bing',
          },
          settings: {
            darkMode: true,            replaceAddressBarSearch: false,
          },
        },
      }),
      set: vi.fn(),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const result = await loadWorkspacePreferences(storageArea);

    expect(storageArea.remove).toHaveBeenCalledWith(WORKSPACE_PREFERENCES_STORAGE_KEY);
    expect(result.preferences).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(result.warning).toMatch(/could not be restored/i);
  });

  it('persists to the canonical preferences key only', async () => {
    const storageArea: WorkspacePreferencesStorageArea = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
    };

    await saveWorkspacePreferences(
      {
        columnCount: 4,
        providersByColumn: {
          1: 'google',
          2: 'duckduckgo',
          3: 'brave',
          4: 'bing',
        },
        settings: {
          darkMode: true,          replaceAddressBarSearch: true,
        },
      },
      storageArea,
    );

    expect(storageArea.set).toHaveBeenCalledWith({
      [WORKSPACE_PREFERENCES_STORAGE_KEY]: {
        schemaVersion: 1,
        columnCount: 4,
        providersByColumn: {
          1: 'google',
          2: 'duckduckgo',
          3: 'brave',
          4: 'bing',
        },
        settings: {
          darkMode: true,          replaceAddressBarSearch: true,
        },
      },
    });
  });

  it('does not throw when storage set rejects', async () => {
    const storageArea: WorkspacePreferencesStorageArea = {
      get: vi.fn(),
      set: vi.fn().mockRejectedValue(new Error('quota exceeded')),
      remove: vi.fn(),
    };

    await expect(
      saveWorkspacePreferences(
        {
          columnCount: 2,
          providersByColumn: DEFAULT_WORKSPACE_PREFERENCES.providersByColumn,
          settings: DEFAULT_WORKSPACE_PREFERENCES.settings,
        },
        storageArea,
      ),
    ).resolves.toBeUndefined();
  });
});
