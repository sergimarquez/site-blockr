/// <reference types="chrome"/>

interface BlockedSites {
  blockedSites: string[];
}

let blockedSites: string[] = [];

// Load initial blocked sites
chrome.storage.local.get(['blockedSites'], (result) => {
  blockedSites = result.blockedSites || [];
  console.log('Loaded blocked sites:', blockedSites);
  updateRules();
});

// Listen for changes in blocked sites
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.blockedSites) {
    blockedSites = changes.blockedSites.newValue || [];
    console.log('Updated blocked sites:', blockedSites);
    updateRules();
  }
});

// Update rules when blocked sites change
async function updateRules() {
  // Remove all existing rules
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: blockedSites.map((_, index) => index + 1)
  });

  const rules = blockedSites.map((site, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: 'block' as const },
    condition: {
      urlFilter: site,
      resourceTypes: ['main_frame' as const]
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: rules
  });

  console.log('Updated rules:', rules);
}

// Check if URL matches any blocked site
function isUrlBlocked(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return blockedSites.some(site => {
      try {
        const siteUrl = new URL(site);
        return urlObj.hostname.includes(siteUrl.hostname);
      } catch {
        // If site is not a valid URL, check if it's a substring
        return url.includes(site);
      }
    });
  } catch {
    // If URL parsing fails, fallback to simple string matching
    return blockedSites.some(site => url.includes(site));
  }
}
