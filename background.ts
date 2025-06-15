/// <reference types="chrome"/>

interface BlockedSites {
  sites: Array<{
    url: string;
    category: string;
  }>;
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
  console.log('Initial storage load:', result);
  if (result.blockedSites) {
    currentState = result.blockedSites as BlockedSites;
  } else {
    currentState = { sites: [], isBlockingEnabled: true };
    // Initialize storage with empty state
    chrome.storage.local.set({ blockedSites: currentState });
  }
  console.log('Current state after load:', currentState);
  updateRules(currentState);
});

// Listen for changes in blocked sites
chrome.storage.onChanged.addListener((changes) => {
  console.log('Storage changed:', changes);
  if (changes.blockedSites) {
    currentState = changes.blockedSites.newValue as BlockedSites;
    console.log('New state:', currentState);
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

async function updateRules(state: BlockedSites) {
  try {
    console.log('Updating rules for state:', state);
    
    // Remove existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    console.log('Existing rules:', existingRules);
    
    const ruleIds = existingRules.map(rule => rule.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds
    });
    console.log('Removed existing rules');

    // Only add new rules if blocking is enabled
    if (state.isBlockingEnabled && state.sites.length > 0) {
      const rules = state.sites.map((site, index) => ({
        id: index + 1,
        priority: 1,
        action: { type: 'block' as const },
        condition: {
          urlFilter: `*://*.${site.url}/*`,
          resourceTypes: ['main_frame' as const]
        }
      }));

      console.log('Adding new rules:', rules);
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules
      });
      console.log('Rules added successfully');
    } else {
      console.log('No rules to add - blocking disabled or no sites');
    }
  } catch (error) {
    console.error('Error updating rules:', error);
  }
}
