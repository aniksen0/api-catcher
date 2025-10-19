const apiCalls = [];

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
    sendResponse([]);
  }
});