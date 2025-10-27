let apiCalls = [];
let captureEnabled = true; // default

function saveApiCalls() {
  try {
    chrome.storage.local.set({ apiCalls });
  } catch (e) {
    // ignore storage errors
  }
}

// Load previously saved API calls (if any) so data survives service worker restarts
chrome.storage.local.get({ apiCalls: [], captureEnabled: true }, (res) => {
  apiCalls = res.apiCalls || [];
  captureEnabled = typeof res.captureEnabled === 'boolean' ? res.captureEnabled : true;
  if (captureEnabled) addListeners();
});

function notifyTabs(apiData) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { action: "newApiCall", data: apiData });
    });
  });
}

// Named handlers so we can remove them later
function onBeforeRequestHandler(details) {
  let body = null;

  if (details.requestBody) {
    if (details.requestBody.raw) {
      try {
        body = new TextDecoder().decode(details.requestBody.raw[0].bytes);
      } catch (e) {
        body = "(binary data)";
      }
    } else if (details.requestBody.formData) {
      body = details.requestBody.formData;
    }
  }

  const apiData = {
    requestId: details.requestId,
    url: details.url,
    method: details.method,
    timeStamp: new Date(details.timeStamp).toLocaleString(),
    requestBody: body,
    requestHeaders: null,
    responseHeaders: null,
    statusCode: null,
  };
  if (
    details.url.startsWith("chrome-extension") ||
    details.url.includes("cdn")
  ) {
    return;
  }
  apiCalls.unshift(apiData); // newest first
  saveApiCalls();
  notifyTabs(apiData);
}

function onBeforeSendHeadersHandler(details) {
  const api = apiCalls.find((a) => a.requestId === details.requestId);
  if (api) {
    api.requestHeaders = details.requestHeaders || [];
    saveApiCalls();
  }
}

function onCompletedHandler(details) {
  const api = apiCalls.find((a) => a.requestId === details.requestId);
  if (api) {
    api.statusCode = details.statusCode;
    api.responseHeaders = details.responseHeaders || [];
    saveApiCalls();
  }
}

function addListeners() {
  try {
    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestHandler, { urls: ["<all_urls>"] }, ["requestBody"]);
    chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeadersHandler, { urls: ["<all_urls>"] }, ["requestHeaders", "extraHeaders"]);
    chrome.webRequest.onCompleted.addListener(onCompletedHandler, { urls: ["<all_urls>"] }, ["responseHeaders", "extraHeaders"]);
  } catch (e) {
    // ignore if listeners already added or permissions missing
  }
}

function removeListeners() {
  try {
    if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequestHandler)) {
      chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequestHandler);
    }
    if (chrome.webRequest.onBeforeSendHeaders.hasListener(onBeforeSendHeadersHandler)) {
      chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeadersHandler);
    }
    if (chrome.webRequest.onCompleted.hasListener(onCompletedHandler)) {
      chrome.webRequest.onCompleted.removeListener(onCompletedHandler);
    }
  } catch (e) {
    // ignore
  }
}

// Messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getApiCalls") {
    sendResponse(apiCalls);
  }
  if (message.action === "getCaptureState") {
    sendResponse({ enabled: !!captureEnabled });
  }
  if (message.action === "startCapture") {
    captureEnabled = true;
    chrome.storage.local.set({ captureEnabled: true });
    addListeners();
    sendResponse({ enabled: true });
  }
  if (message.action === "stopCapture") {
    captureEnabled = false;
    chrome.storage.local.set({ captureEnabled: false });
    removeListeners();
    sendResponse({ enabled: false });
  }
  if (message.action === "clearApiCalls") {
    apiCalls = [];
    // persist cleared state then respond
    chrome.storage.local.set({ apiCalls: [] }, () => {
      sendResponse([]);
    });
    return true; // keep the message channel open for async response
  }
});