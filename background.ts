chrome.webRequest.onBeforeRequest.addListener(
    function (details: chrome.webRequest.OnBeforeRequestDetails) {
      const blockedSites = ["facebook.com", "youtube.com"];
      return blockedSites.some(site => details.url.includes(site))
        ? { cancel: true }
        : { cancel: false };
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
  );
  