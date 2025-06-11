import { useEffect, useState } from 'react';

const STORAGE_KEY = 'blockedSites';

function App() {
  const [sites, setSites] = useState<string[]>([]);
  const [input, setInput] = useState('');

  // Load from chrome.storage
  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      setSites(result[STORAGE_KEY] || []);
    });
  }, []);

  // Save to chrome.storage
  const updateStorage = (newSites: string[]) => {
    chrome.storage.local.set({ [STORAGE_KEY]: newSites });
    setSites(newSites);
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
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. twitter.com"
        className="border p-2 rounded w-full mb-2"
      />
      <button onClick={addSite} className="bg-blue-600 text-white px-4 py-2 rounded">
        Add Site
      </button>
      <ul className="mt-4">
        {sites.map(site => (
          <li key={site} className="flex justify-between items-center border-b py-1">
            <span>{site}</span>
            <button onClick={() => removeSite(site)} className="text-red-500">Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
