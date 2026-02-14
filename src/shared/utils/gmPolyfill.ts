/**
 * Greasemonkey/Tampermonkey API Polyfill for Pager
 * Provides a subset of GM_* APIs for user scripts
 */

export const GM_POLYFILL_INJECTED = 'GM_POLYFILL_INJECTED'

/**
 * Generates Greasemonkey/Tampermonkey API polyfill code for injection
 */
export function generateGMPolyfillCode(scriptId?: string): string {
  return `
// Greasemonkey/Tampermonkey API Polyfill for Pager
(function() {
  'use strict';

  // 防止重复注入（但允许多个不同脚本的 polyfill）
  const SCRIPT_ID = '${scriptId || 'global'}';
  const POLYFILL_KEY = '${GM_POLYFILL_INJECTED}_' + SCRIPT_ID;
  
  if (window[POLYFILL_KEY]) {
    return;
  }
  window[POLYFILL_KEY] = true;

  // 存储命名空间（每个脚本独立的存储）
  const GM_STORAGE_PREFIX = 'pager_gm_storage_';

  // 获取脚本 ID
  function getScriptId() {
    return SCRIPT_ID;
  }

  // 存储辅助函数
  function getStorageKey(key, scriptId) {
    return GM_STORAGE_PREFIX + scriptId + '_' + key;
  }

  // GM_setValue - 存储数据
  const GM_setValue = function(key, value) {
    const scriptId = getScriptId();
    const storageKey = getStorageKey(key, scriptId);
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[GM Polyfill] GM_setValue failed:', e);
      return false;
    }
  };

  // GM_getValue - 读取数据
  const GM_getValue = function(key, defaultValue) {
    const scriptId = getScriptId();
    const storageKey = getStorageKey(key, scriptId);
    try {
      const value = localStorage.getItem(storageKey);
      if (value === null) {
        return defaultValue;
      }
      return JSON.parse(value);
    } catch (e) {
      console.error('[GM Polyfill] GM_getValue failed:', e);
      return defaultValue;
    }
  };

  // GM_deleteValue - 删除数据
  const GM_deleteValue = function(key) {
    const scriptId = getScriptId();
    const storageKey = getStorageKey(key, scriptId);
    try {
      localStorage.removeItem(storageKey);
      return true;
    } catch (e) {
      console.error('[GM Polyfill] GM_deleteValue failed:', e);
      return false;
    }
  };

  // GM_listValues - 列出所有键
  const GM_listValues = function() {
    const scriptId = getScriptId();
    const prefix = GM_STORAGE_PREFIX + scriptId + '_';
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key.substring(prefix.length));
        }
      }
    } catch (e) {
      console.error('[GM Polyfill] GM_listValues failed:', e);
    }
    return keys;
  };

  // GM_notification - 显示通知
  const GM_notification = function(options, ondone) {
    // 简单实现：使用浏览器通知 API
    if (typeof Notification === 'undefined') {
      console.warn('[GM Polyfill] GM_notification: Notifications not supported');
      if (ondone) ondone();
      return;
    }

    const title = options.title || 'Pager Script';
    const body = options.text || options.body || '';
    const icon = options.image || null;
    const timeout = options.timeout || 5000;

    try {
      const notification = new Notification(title, {
        body,
        icon
      });

      if (timeout) {
        setTimeout(() => notification.close(), timeout);
      }

      notification.onclick = function() {
        if (options.onclick) {
          options.onclick(notification);
        }
        notification.close();
      };

      if (ondone) {
        notification.onclose = ondone;
      }
    } catch (e) {
      console.error('[GM Polyfill] GM_notification failed:', e);
      if (ondone) ondone();
    }
  };

  // GM_openInTab - 在新标签页中打开 URL
  const GM_openInTab = function(url, options) {
    const openInBackground = options && options.active === false;
    const openInParent = options && options.setParent;

    // 在 Pager 中，我们不能直接打开新标签页
    // 所以使用 window.open 作为替代
    const newWindow = window.open(url, openInBackground ? '_blank' : '_self');

    if (openInParent && newWindow) {
      newWindow.opener = window;
    }

    return newWindow;
  };

  // GM_setClipboard - 设置剪贴板
  const GM_setClipboard = function(text, info) {
    try {
      // 尝试使用 Clipboard API
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        return true;
      }
      // 回退方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      console.error('[GM Polyfill] GM_setClipboard failed:', e);
      return false;
    }
  };

  // GM_xmlhttpRequest - XMLHttpRequest 包装
  const GM_xmlhttpRequest = function(details) {
    const xhr = new XMLHttpRequest();

    xhr.open(
      details.method || 'GET',
      details.url,
      true,
      details.user || null,
      details.password || null
    );

    if (details.headers) {
      for (const key in details.headers) {
        if (details.headers.hasOwnProperty(key)) {
          xhr.setRequestHeader(key, details.headers[key]);
        }
      }
    }

    if (details.overrideMimeType) {
      xhr.overrideMimeType(details.overrideMimeType);
    }

    if (details.responseType) {
      xhr.responseType = details.responseType;
    }

    xhr.timeout = details.timeout || 0;

    // 事件处理
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        const response = {
          status: xhr.status,
          statusText: xhr.statusText,
          responseHeaders: xhr.getAllResponseHeaders(),
          response: xhr.response,
          responseText: xhr.responseText,
          responseXML: xhr.responseXML,
          finalUrl: xhr.responseURL
        };

        if (xhr.status >= 200 && xhr.status < 300) {
          if (details.onload) {
            details.onload(response);
          }
        } else {
          if (details.onerror) {
            details.onerror(response);
          }
        }

        if (details.onloadend) {
          details.onloadend(response);
        }
      }
    };

    xhr.onprogress = function(e) {
      if (details.onprogress) {
        details.onprogress({
          lengthComputable: e.lengthComputable,
          loaded: e.loaded,
          total: e.total
        });
      }
    };

    xhr.ontimeout = function() {
      if (details.ontimeout) {
        details.ontimeout({
          status: 0,
          statusText: 'timeout'
        });
      }
    };

    xhr.onabort = function() {
      if (details.onabort) {
        details.onabort({
          status: 0,
          statusText: 'abort'
        });
      }
    };

    if (details.data !== undefined) {
      xhr.send(details.data);
    } else {
      xhr.send();
    }

    return {
      abort: function() {
        xhr.abort();
      }
    };
  };

  // GM_addStyle - 添加 CSS 样式
  const GM_addStyle = function(css) {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.textContent = css;
    const head = document.head || document.documentElement;
    head.appendChild(style);
    return style;
  };

  // GM_addElement - 添加元素
  const GM_addElement = function(parentNode, tagName, attributes) {
    const parent = parentNode || document.body;
    const element = document.createElement(tagName);
    
    if (attributes) {
      for (const key in attributes) {
        if (attributes.hasOwnProperty(key)) {
          if (key === 'textContent' || key === 'innerHTML') {
            element[key] = attributes[key];
          } else if (key === 'style') {
            Object.assign(element.style, attributes[key]);
          } else if (key === 'dataset') {
            Object.assign(element.dataset, attributes[key]);
          } else {
            element.setAttribute(key, attributes[key]);
          }
        }
      }
    }
    
    parent.appendChild(element);
    return element;
  };

  // GM_registerMenuCommand - 注册菜单命令（简化实现）
  const GM_registerMenuCommand = function(name, callback, accessKey) {
    console.log('[GM Polyfill] GM_registerMenuCommand:', name);
    // 在 Pager 中无法直接添加浏览器工具栏按钮
    // 这里只记录，实际实现需要通过 Pager 的 UI 暴露
    // 可以考虑添加一个 "脚本命令" 按钮，点击后显示已注册的命令
    return name;
  };

  // GM_unregisterMenuCommand - 注销菜单命令
  const GM_unregisterMenuCommand = function(name) {
    console.log('[GM Polyfill] GM_unregisterMenuCommand:', name);
  };

  // GM_getResourceText - 获取资源文本（简化实现）
  const GM_getResourceText = function(name) {
    console.warn('[GM Polyfill] GM_getResourceText not fully implemented');
    return '';
  };

  // GM_getResourceURL - 获取资源 URL（简化实现）
  const GM_getResourceURL = function(name) {
    console.warn('[GM Polyfill] GM_getResourceURL not fully implemented');
    return '';
  };

  // GM_log - 日志输出
  const GM_log = function(...args) {
    console.log('[GM Script]', ...args);
  };

  // 导出到全局对象
  window.GM = {
    setValue: GM_setValue,
    getValue: GM_getValue,
    deleteValue: GM_deleteValue,
    listValues: GM_listValues,
    notification: GM_notification,
    openInTab: GM_openInTab,
    setClipboard: GM_setClipboard,
    xmlhttpRequest: GM_xmlhttpRequest,
    addStyle: GM_addStyle,
    addElement: GM_addElement,
    registerMenuCommand: GM_registerMenuCommand,
    unregisterMenuCommand: GM_unregisterMenuCommand,
    getResourceText: GM_getResourceText,
    getResourceURL: GM_getResourceURL,
    log: GM_log
  };

  // 兼容旧版本的别名
  window.GM_setValue = GM_setValue;
  window.GM_getValue = GM_getValue;
  window.GM_deleteValue = GM_deleteValue;
  window.GM_listValues = GM_listValues;
  window.GM_notification = GM_notification;
  window.GM_openInTab = GM_openInTab;
  window.GM_setClipboard = GM_setClipboard;
  window.GM_xmlhttpRequest = GM_xmlhttpRequest;
  window.GM_addStyle = GM_addStyle;
  window.GM_addElement = GM_addElement;
  window.GM_registerMenuCommand = GM_registerMenuCommand;
  window.GM_unregisterMenuCommand = GM_unregisterMenuCommand;

  // GM_info - 脚本信息
  window.GM_info = {
    script: {
      version: '1.0.0',
      name: 'UserScript',
      description: 'Pager UserScript',
      namespace: 'pager-userscript',
      author: 'User'
    },
    scriptMetaStr: '',
    scriptHandler: 'Pager',
    version: '1.0.0'
  };

  console.log('[GM Polyfill] GM APIs loaded successfully');
})();
`
}
