let apiCalls = [];

function saveApiCalls() {
  try {
    chrome.storage.local.set({ apiCalls });
  } catch (e) {
    // ignore storage errors
  }
}

// Load previously saved API calls (if any) so data survives service worker restarts
chrome.storage.local.get({ apiCalls: [] }, (res) => {
  apiCalls = res.apiCalls || [];
});

function notifyTabs(apiData) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { action: "newApiCall", data: apiData });
    });
  });
}

// Capture request start
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
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
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Capture headers
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const api = apiCalls.find((a) => a.requestId === details.requestId);
    if (api) {
      api.requestHeaders = details.requestHeaders || [];
      saveApiCalls();
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

// Capture response
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const api = apiCalls.find((a) => a.requestId === details.requestId);
    if (api) {
      api.statusCode = details.statusCode;
      api.responseHeaders = details.responseHeaders || [];
      saveApiCalls();
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);

// Messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getApiCalls") {
    sendResponse(apiCalls);
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