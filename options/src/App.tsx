import { useEffect, useState } from 'react';

const STORAGE_KEY = 'blockedSites';
const BLOCKING_ENABLED_KEY = 'isBlockingEnabled';

function App() {
  const [sites, setSites] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isBlockingEnabled, setIsBlockingEnabled] = useState(true);

  // Load from chrome.storage
  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY, BLOCKING_ENABLED_KEY], (result) => {
      setSites(result[STORAGE_KEY] || []);
      setIsBlockingEnabled(result[BLOCKING_ENABLED_KEY] ?? true);
    });
  }, []);

  // Save to chrome.storage
  const updateStorage = (newSites: string[]) => {
    chrome.storage.local.set({ [STORAGE_KEY]: newSites });
    setSites(newSites);
  };

  const toggleBlocking = () => {
    const newState = !isBlockingEnabled;
    chrome.storage.local.set({ [BLOCKING_ENABLED_KEY]: newState });
    setIsBlockingEnabled(newState);
  };

  const addSite = () => {
    if (!input.trim()) return;
    const newSites = [...new Set([...sites, input.trim()])];
    updateStorage(newSites);
    setInput('');
  };

  const removeSite = (site: string) => {
    const newSites = sites.filter(s => s !== site);
    updateStorage(newSites);
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">SiteBlockr Dashboard</h1>
      
      {/* Blocking Toggle */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-100 rounded">
        <span className="font-medium">Blocking Enabled</span>
        <button
          onClick={toggleBlocking}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            isBlockingEnabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isBlockingEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. twitter.com"
        className="w-full p-2 border rounded mb-2"
      />
      <button onClick={addSite} className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Add Site
      </button>
      <ul className="mt-4 space-y-2">
        {sites.map(site => (
          <li key={site} className="flex justify-between items-center p-2 border-b">
            <span>{site}</span>
            <button onClick={() => removeSite(site)} className="text-red-500 hover:text-red-700">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
