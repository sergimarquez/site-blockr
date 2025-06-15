/// <reference types="chrome"/>

interface BlockedSites {
  blockedSites: string[];
}

let blockedSites: string[] = [];
let isBlockingEnabled: boolean = true; // Default to enabled

// Load initial state
chrome.storage.local.get(['blockedSites', 'isBlockingEnabled'], (result) => {
  blockedSites = result.blockedSites || [];
  isBlockingEnabled = result.isBlockingEnabled ?? true; // Default to true if not set
  console.log('Loaded state:', { blockedSites, isBlockingEnabled });
  updateRules();
});

// Listen for changes in blocked sites and blocking state
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.blockedSites) {
      blockedSites = changes.blockedSites.newValue || [];
      console.log('Updated blocked sites:', blockedSites);
    }
    if (changes.isBlockingEnabled) {
      isBlockingEnabled = changes.isBlockingEnabled.newValue;
      console.log('Updated blocking state:', isBlockingEnabled);
    }
    updateRules();
  }
});

// Update rules when blocked sites change
async function updateRules() {
  // Remove all existing rules
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: blockedSites.map((_, index) => index + 1)
  });

  // Only add rules if blocking is enabled
  if (isBlockingEnabled) {
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
  } else {
    console.log('Blocking is disabled, no rules added');
  }
}

// Check if URL matches any blocked site
function isUrlBlocked(url: string): boolean {
  if (!isBlockingEnabled) return false;
  
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
