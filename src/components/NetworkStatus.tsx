import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;
  return <div className="offline-banner" role="status"><WifiOff size={17} /> You are offline. Existing content may remain visible, but changes will wait for a connection.</div>;
}
