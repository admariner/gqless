import {
  SelectionManager,
  SelectionsBackup,
} from '../Selection/SelectionManager';
import { decycle, isPlainObject, retrocycle } from '../Utils';
import { CacheInstance } from './dataCache';

export interface PersistenceHelpers {
  backupPersistence(version?: string): string;

  restorePersistence(
    backup: () => Promise<unknown>,
    expectedVersion?: string | undefined
  ): Promise<boolean>;
  restorePersistence(
    backup: string | null | undefined,
    expectedVersion?: string | undefined
  ): boolean;
}

export function createPersistenceHelpers(
  clientCache: CacheInstance,
  selectionManager: SelectionManager
): PersistenceHelpers {
  function backupPersistence(version?: string): string {
    const { query } = clientCache.cache;
    const cache = decycle({ query });
    let normalizedCache: object | undefined;
    if (clientCache.normalizedCache) {
      normalizedCache = decycle(clientCache.normalizedCache);
    }
    const selections = selectionManager.backup();

    return JSON.stringify({ version, cache, normalizedCache, selections });
  }

  function restorePersistence(
    backup: () => Promise<unknown>,
    expectedVersion?: string
  ): Promise<boolean>;
  function restorePersistence(
    backup: string | null | undefined,
    expectedVersion?: string
  ): boolean;
  function restorePersistence(
    backup: string | null | undefined | (() => Promise<unknown>),
    expectedVersion?: string
  ): boolean | Promise<boolean> {
    if (typeof backup === 'function') {
      return new Promise((resolve) => {
        backup()
          .then((value) => resolve(restore(value)))
          .catch(() => resolve(false));
      });
    }
    return restore(backup);

    function restore(backup?: unknown) {
      if (typeof backup !== 'string') return false;

      const backupObject: {
        cache?: Record<string, unknown>;
        normalizedCache?: Record<string, unknown>;
        selections?: SelectionsBackup;
        version?: string;
      } = JSON.parse(backup);

      if (isPlainObject(backupObject) && isPlainObject(backupObject.cache)) {
        if (
          (expectedVersion && !backupObject.version) ||
          (backupObject.version && !expectedVersion)
        ) {
          return false;
        }
        if (expectedVersion && backupObject.version) {
          if (typeof backupObject.version === 'string') {
            if (backupObject.version !== expectedVersion) {
              return false;
            }
          } else {
            return false;
          }
        }

        Object.assign(clientCache.cache, retrocycle(backupObject.cache));
        if (isPlainObject(backupObject.normalizedCache)) {
          Object.assign(
            clientCache.normalizedCache,
            retrocycle(backupObject.normalizedCache)
          );
        }

        selectionManager.restore(backupObject.selections);

        return true;
      }

      return false;
    }
  }

  return {
    backupPersistence,
    restorePersistence,
  };
}