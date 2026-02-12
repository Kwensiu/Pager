/**
 * Chrome Extension Polyfills for Electron
 * Shared utility for injecting Chrome API polyfills into extension contexts
 */

export const CHROME_POLYFILL_INJECTED = 'CHROME_POLYFILL_INJECTED'

/**
 * Generates the complete Chrome API polyfill code for injection
 */
export function generateChromePolyfillCode(): string {
  return `
// Polyfill for chrome APIs in Electron - MUST RUN FIRST
(function() {
  'use strict';

  // 防止重复注入的标记
  if (window.${CHROME_POLYFILL_INJECTED}) {
    return;
  }
  window.${CHROME_POLYFILL_INJECTED} = true;

  // Define chrome object if not exists
  if (typeof chrome === 'undefined') {
    window.chrome = {};
  }

  // Simple chrome.storage.local implementation using localStorage
  if (!chrome.storage) {
    chrome.storage = {};
  }

  if (!chrome.storage.local) {
    var storageData = {};
    try {
      var stored = localStorage.getItem('chrome_extension_storage');
      if (stored) {
        storageData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[Polyfill] Failed to load stored data:', e);
    }

    function saveStorage() {
      try {
        localStorage.setItem('chrome_extension_storage', JSON.stringify(storageData));
      } catch (e) {
        console.warn('[Polyfill] Failed to save storage data:', e);
      }
    }

    chrome.storage.local = {
      get: function(keys, callback) {
        var result = {};
        if (keys === null || keys === undefined) {
          result = JSON.parse(JSON.stringify(storageData));
        } else if (typeof keys === 'string') {
          result[keys] = storageData[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(function(key) {
            result[key] = storageData[key];
          });
        }
        if (typeof callback === 'function') {
          callback(result);
        }
        return Promise.resolve(result);
      },

      set: function(items, callback) {
        Object.assign(storageData, items);
        saveStorage();
        if (typeof callback === 'function') {
          callback();
        }
        return Promise.resolve();
      }
    };
  }

  console.log('[Polyfill] Basic chrome.storage.local polyfill injected');
})();
`
}
