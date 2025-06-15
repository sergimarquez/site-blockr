/// <reference types="chrome"/>

interface BlockedSites {
  sites: Array<{
    url: string;
    category: string;
  }>;
  isBlockingEnabled: boolean;
}

// Load initial blocked sites from storage
chrome.storage.local.get(['blockedSites'], (result) => {
  const data: BlockedSites = result.blockedSites || { sites: [], isBlockingEnabled: true };
  console.log('Loaded blocked sites:', data);
  updateRules(data.sites, data.isBlockingEnabled);
});

// Listen for changes in blocked sites
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.blockedSites) {
    const newData: BlockedSites = changes.blockedSites.newValue;
    console.log('Updated blocked sites:', newData);
    updateRules(newData.sites, newData.isBlockingEnabled);
  }
});

// Update blocking rules
async function updateRules(sites: BlockedSites['sites'], isEnabled: boolean) {
  try {
    // Remove existing rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules.map(rule => rule.id);
    
    if (ruleIdsToRemove.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove
      });
    }

    // Add new rules if blocking is enabled
    if (isEnabled && sites.length > 0) {
      const rules = sites.map((site, index) => ({
        id: index + 1,
        priority: 1,
        action: { type: 'block' as const },
        condition: {
          urlFilter: `*://*${site.url}/*`,
          resourceTypes: ['main_frame' as const]
        }
      }));

      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules
      });
      
      console.log('Added blocking rules for', sites.length, 'sites');
    } else {
      console.log('Blocking disabled or no sites to block');
    }
  } catch (error) {
    console.error('Error updating rules:', error);
  }
}
