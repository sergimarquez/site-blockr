import { useEffect, useState } from 'react';
import './App.css';

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
    <div className="app-container">
      <h1>SiteBlockr Dashboard</h1>
      
      {/* Blocking Toggle */}
      <div className="toggle-container">
        <span>Blocking Enabled</span>
        <button
          onClick={toggleBlocking}
          className={`toggle-button ${isBlockingEnabled ? 'enabled' : 'disabled'}`}
        >
          <span className="toggle-slider" />
        </button>
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. twitter.com"
        className="site-input"
      />
      <button onClick={addSite} className="add-button">
        Add Site
      </button>
      <ul className="site-list">
        {sites.map(site => (
          <li key={site} className="site-item">
            <span>{site}</span>
            <button onClick={() => removeSite(site)} className="remove-button">Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
