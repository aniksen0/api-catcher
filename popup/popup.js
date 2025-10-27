document.addEventListener("DOMContentLoaded", () => {
  const apiList = document.getElementById("apiList");
  const searchBox = document.getElementById("searchBox");
  const foldersDiv = document.getElementById("folders");

  let apis = [];
  let filter = "all";
  let folders = {};
  let currentFolder = null; // when set, render only items in this folder

  // Save/load folders in chrome storage
  function saveFolders() {
    chrome.storage.local.set({ folders });
  }
  function clearFolders() {
    folders = {};
    chrome.storage.local.remove("folders");
    currentFolder = null;
  }

  function loadFolders(cb) {
    chrome.storage.local.get("folders", (res) => {
      folders = res.folders || {};
      if (cb) cb();
    });
  }

  // Render API list
  function render() {
    apiList.innerHTML = "";

    // Determine which set of APIs to show: folder view or main view (excluding moved)
    let items = [];
    if (currentFolder) {
      const ids = folders[currentFolder] || [];
      items = apis.filter((api) => ids.includes(api.requestId));
    } else {
      items = apis.filter((api) => !api.movedTo);
    }

    let filtered = items;

    if (filter === "unique") {
      filtered = filtered.filter(
        (api, idx, self) => idx === self.findIndex((a) => a.url === api.url)
      );
    }

    if (searchBox.value) {
      filtered = filtered.filter((api) =>
        api.url.toLowerCase().includes(searchBox.value.toLowerCase())
      );
    }

    const countEl = document.getElementById("count");
    if (currentFolder) {
      countEl.textContent = `Folder: ${currentFolder} — ${filtered.length} APIs`;
    } else {
      countEl.textContent = `Total APIs: ${filtered.length}`;
    }

    if (filtered.length === 0) {
      apiList.innerHTML = `<p>No API calls found</p>`;
      return;
    }

    // If we're in a folder view, show a back button to return to the folders/main list
    if (currentFolder) {
      const header = document.createElement("div");
      header.className = "mb-2";
      header.innerHTML = `<button id="backToFolders" class="bg-blue-600 px-2 py-1 rounded">← Back to Folders</button>`;
      header.querySelector("#backToFolders").addEventListener("click", () => {
        currentFolder = null;
        render();
      });
      apiList.appendChild(header);
    }

    filtered.forEach((api) => {
      const div = document.createElement("div");
      div.className =
        "p-2 bg-gray-800 rounded shadow text-sm break-words cursor-pointer";

      div.innerHTML = `
        <p class="font-bold">${api.method} - ${api.statusCode || ""}</p>
        <p>${api.url}</p>
        <p class="text-xs text-gray-400">${api.timeStamp}</p>
        <button class="mt-1 bg-yellow-600 text-xs px-2 py-1 rounded">Move to Folder</button>
      `;

      // Click → show details
      div.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") {
          e.stopPropagation();
          showFolderSelection(api);
        } else {
          showDetails(api);
        }
      });

      apiList.appendChild(div);
    });
  }

  // Render Folders
  function renderFolders() {
    foldersDiv.innerHTML = "";
    Object.keys(folders).forEach((folderName) => {
      const div = document.createElement("div");
      div.className = "bg-gray-700 p-2 rounded";

      div.innerHTML = `
        <p class="font-bold">${folderName} (${folders[folderName].length})</p>
        <div class="mt-1 flex gap-2">
          <button class="bg-blue-600 px-2 py-1 text-xs rounded view-folder">View</button>
          <button class="bg-purple-600 px-2 py-1 text-xs rounded export-folder">Export</button>
        </div>
      `;

      div.querySelector(".export-folder").addEventListener("click", () => {
        const requests = apis.filter((api) =>
          folders[folderName].includes(api.requestId)
        );
        exportToPostman(requests, folderName);
      });

      div.querySelector(".view-folder").addEventListener("click", () => {
        currentFolder = folderName;
        render();
      });

      foldersDiv.appendChild(div);
    });
  }

  // Folder Selection Popup
  function showFolderSelection(api) {
    const folderNames = Object.keys(folders);
    if (folderNames.length === 0) {
      alert("No folders found. Create one first.");
      return;
    }

    // Create a simple modal in the popup to choose a folder
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3";
    modal.style.zIndex = 9999;

    const box = document.createElement("div");
    box.className = "bg-gray-900 p-3 rounded w-full";
    box.innerHTML = `<h3 class="font-bold mb-2">Move request to folder</h3>`;

    const list = document.createElement("div");
    list.className = "space-y-2";

    folderNames.forEach((fname) => {
      const btn = document.createElement("button");
      btn.className = "w-full text-left bg-gray-800 px-2 py-1 rounded";
      btn.textContent = `${fname} (${folders[fname].length})`;
      btn.addEventListener("click", () => {
        if (!folders[fname].includes(api.requestId)) {
          folders[fname].push(api.requestId);
          // mark the api as moved so it is removed from the main list
          api.movedTo = fname;
          saveFolders();
          renderFolders();
          render();
        }
        modal.remove();
      });
      list.appendChild(btn);
    });

    const cancel = document.createElement("button");
    cancel.className = "mt-2 w-full bg-red-600 px-2 py-1 rounded";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => modal.remove());

    box.appendChild(list);
    box.appendChild(cancel);
    modal.appendChild(box);
    document.body.appendChild(modal);
  }

  // Details view
  function showDetails(api) {
    apiList.innerHTML = `
      <div class="p-3 bg-gray-900 rounded text-sm">
        <button id="backBtn" class="bg-blue-600 px-2 py-1 rounded mb-3">← Back</button>
        <h2 class="text-lg font-bold mb-2">Request Details</h2>
        <p><strong>URL:</strong> ${api.url}</p>
        <p><strong>Method:</strong> ${api.method}</p>
        <p><strong>Status:</strong> ${api.statusCode || "N/A"}</p>

        <h3 class="mt-2 font-bold">Headers</h3>
        <pre class="bg-gray-800 p-2 rounded overflow-x-auto text-xs">${
          api.requestHeaders
            ? JSON.stringify(api.requestHeaders, null, 2)
            : "No headers"
        }</pre>

        <h3 class="mt-2 font-bold">Body</h3>
        <pre class="bg-gray-800 p-2 rounded overflow-x-auto text-xs">${
          api.requestBody ? JSON.stringify(api.requestBody, null, 2) : "No body"
        }</pre>
      </div>
    `;

    document.getElementById("backBtn").addEventListener("click", render);
  }

  // Export to Postman
  function exportToPostman(requests, collectionName = "API Catcher Export") {
    const postmanCollection = {
      info: {
        _postman_id: crypto.randomUUID(),
        name: collectionName,
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: requests.map((api) => ({
        name: api.url,
        request: {
          method: api.method,
          header: (api.requestHeaders || []).map((h) => ({
            key: h.name,
            value: h.value,
          })),
          body: api.requestBody
            ? { mode: "raw", raw: api.requestBody }
            : undefined,
          url: {
            raw: api.url,
            host: [api.url.split("/")[2]],
            path: api.url.split("/").slice(3),
          },
        },
        response: [],
      })),
    };

    const blob = new Blob([JSON.stringify(postmanCollection, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${collectionName}.postman_collection.json`;
    a.click();
  }

  // Load APIs
  function loadApis() {
    chrome.runtime.sendMessage({ action: "getApiCalls" }, (res) => {
      apis = res || [];
      // Ensure movedTo flags match stored folders
      Object.keys(folders).forEach((fname) => {
        (folders[fname] || []).forEach((id) => {
          const a = apis.find((x) => x.requestId === id);
          if (a) a.movedTo = fname;
        });
      });
      render();
      renderFolders();
    });
  }

  // Capture toggle UI
  const toggleCaptureBtn = document.getElementById("toggleCaptureBtn");
  function updateToggleLabel(enabled) {
    toggleCaptureBtn.textContent = enabled ? "Pause Capture" : "Start Capture";
    toggleCaptureBtn.className = enabled ? "bg-yellow-500 px-3 py-1 rounded" : "bg-green-600 px-3 py-1 rounded";
  }

  // Query background for current capture state
  chrome.runtime.sendMessage({ action: "getCaptureState" }, (res) => {
    updateToggleLabel(res && res.enabled);
  });

  toggleCaptureBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getCaptureState" }, (res) => {
      const enabled = res && res.enabled;
      if (enabled) {
        chrome.runtime.sendMessage({ action: "stopCapture" }, (r) => updateToggleLabel(!r.enabled));
      } else {
        chrome.runtime.sendMessage({ action: "startCapture" }, (r) => updateToggleLabel(!!r.enabled));
      }
    });
  });

  // Events
  document.getElementById("showAll").addEventListener("click", () => {
    filter = "all";
    render();
  });

  document.getElementById("showUnique").addEventListener("click", () => {
    filter = "unique";
    render();
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "clearApiCalls" }, () => {
      apis = [];
      render();
    });
  });

  document.getElementById("clearFolder").addEventListener("click", () => {
    clearFolders();
    renderFolders();
    render();
  });

  document.getElementById("createFolderBtn").addEventListener("click", () => {
    const name = prompt("Enter folder name:");
    if (name && !folders[name]) {
      folders[name] = [];
      saveFolders();
      renderFolders();
    }
  });

  document.getElementById("exportAllBtn").addEventListener("click", () => {
    exportToPostman(apis, "All APIs");
  });

  document.getElementById("exportFilteredBtn").addEventListener("click", () => {
    // Export the same list that is visible in the main view (exclude moved items)
    let filtered = apis.filter((api) => !api.movedTo);
    if (filter === "unique") {
      filtered = filtered.filter(
        (api, idx, self) => idx === self.findIndex((a) => a.url === api.url)
      );
    }
    if (searchBox.value) {
      filtered = filtered.filter((api) =>
        api.url.toLowerCase().includes(searchBox.value.toLowerCase())
      );
    }
    exportToPostman(filtered, "Filtered APIs");
  });

  searchBox.addEventListener("input", render);

  loadFolders(() => loadApis());
});
