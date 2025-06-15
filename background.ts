/// <reference types="chrome"/>

interface BlockedSites {
  sites: string[];
  isBlockingEnabled: boolean;
  focusMode?: {
    isActive: boolean;
    endTime?: number;
    duration?: number;
  };
  schedule?: {
    startTime: string;
    endTime: string;
    days: number[];
  };
}

let currentState: BlockedSites = {
  sites: [],
  isBlockingEnabled: true
};

// Load initial blocked sites from chrome.storage
chrome.storage.local.get(['blockedSites'], (result) => {
  currentState = result.blockedSites as BlockedSites || { sites: [], isBlockingEnabled: true };
  updateRules(currentState);
});

// Listen for changes in blocked sites
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedSites) {
    currentState = changes.blockedSites.newValue as BlockedSites;
    updateRules(currentState);

    // Handle focus mode timer
    if (currentState.focusMode?.isActive && currentState.focusMode.endTime) {
      const timeLeft = currentState.focusMode.endTime - Date.now();
      if (timeLeft > 0) {
        setTimeout(() => {
          // Disable focus mode when timer ends
          chrome.storage.local.get(['blockedSites'], (result) => {
            const currentData = result.blockedSites as BlockedSites;
            chrome.storage.local.set({
              blockedSites: {
                ...currentData,
                focusMode: { isActive: false }
              }
            });
          });
        }, timeLeft);
      }
    }
  }
});

// Check schedule on startup and every minute
function checkSchedule() {
  chrome.storage.local.get(['blockedSites'], (result) => {
    const data = result.blockedSites as BlockedSites;
    if (data.schedule) {
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [startHour, startMinute] = data.schedule.startTime.split(':').map(Number);
      const [endHour, endMinute] = data.schedule.endTime.split(':').map(Number);
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;

      const isWithinSchedule = 
        data.schedule.days.includes(currentDay) &&
        currentTime >= startTime &&
        currentTime < endTime;

      if (isWithinSchedule !== data.isBlockingEnabled) {
        chrome.storage.local.set({
          blockedSites: {
            ...data,
            isBlockingEnabled: isWithinSchedule
          }
        });
      }
    }
  });
}

// Check schedule immediately and then every minute
checkSchedule();
setInterval(checkSchedule, 60000);

async function updateRules(state: BlockedSites) {
  // Remove existing rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIds = existingRules.map(rule => rule.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ruleIds
  });

  // Only add new rules if blocking is enabled
  if (state.isBlockingEnabled && state.sites.length > 0) {
    const rules = state.sites.map((site: string, index: number) => ({
      id: index + 1,
      priority: 1,
      action: { type: 'block' as const },
      condition: {
        urlFilter: `*://*.${site}/*`,
        resourceTypes: ['main_frame' as const]
      }
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules
    });
  }
}

// Helper functions for checking if a URL should be blocked
function shouldBlockUrl(url: string): boolean {
  if (!currentState.isBlockingEnabled) return false;

  // Check if URL matches any blocked site
  return currentState.sites.some(site => url.includes(site));
}

// Listen for web requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (shouldBlockUrl(details.url)) {
      return { cancel: true };
    }
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
