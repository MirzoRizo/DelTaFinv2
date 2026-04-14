// src/components/SyncSettings.tsx
import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { startSync, stopSync, getSyncStatus } from '../lib/sync';

export function SyncSettings() {
  const [supabaseUrl, setSupabaseUrl] = useState(
    localStorage.getItem('sync_supabase_url') ?? '',
  );
  const [supabaseKey, setSupabaseKey] = useState(
    localStorage.getItem('sync_supabase_key') ?? '',
  );
  const [syncEnabled, setSyncEnabled] = useState(
    localStorage.getItem('sync_enabled') === 'true',
  );
  const [status, setStatus] = useState<'off' | 'on' | 'error'>(
    syncEnabled ? 'on' : 'off',
  );
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!syncEnabled) return;
    const interval = setInterval(() => {
      const s = getSyncStatus();
      if (s.lastSyncAt > 0) {
        setStatus('on');
        setLastSync(new Date(s.lastSyncAt).toLocaleTimeString('ru-RU'));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [syncEnabled]);

  function handleSave() {
    localStorage.setItem('sync_supabase_url', supabaseUrl.trim());
    localStorage.setItem('sync_supabase_key', supabaseKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleToggle() {
    if (syncEnabled) {
      stopSync();
      setSyncEnabled(false);
      setStatus('off');
      localStorage.setItem('sync_enabled', 'false');
    } else {
      if (!supabaseUrl || !supabaseKey) {
        alert('Заполни Supabase URL и Key');
        return;
      }
      try {
        await startSync();
        setSyncEnabled(true);
        setStatus('on');
        localStorage.setItem('sync_enabled', 'true');
      } catch (e) {
        setStatus('error');
        alert(`Ошибка: ${e}`);
      }
    }
  }

  const inpStyle: React.CSSProperties = {
    background: 'var(--surface2)',
    border: '1px solid var(--border-md)',
    color: 'var(--text-1)',
    fontFamily: 'monospace',
    fontSize: '12px',
  };
  const inpCls = 'w-full px-3 py-2.5 rounded-lg outline-none transition-all';

  return (
    <div className="space-y-4">
      {/* Статус */}
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border-md)',
        }}
      >
        <div className="flex items-center gap-3">
          {status === 'on' && (
            <Cloud className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          )}
          {status === 'off' && (
            <CloudOff className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
          )}
          {status === 'error' && (
            <AlertCircle className="w-4 h-4" style={{ color: 'var(--red)' }} />
          )}
          <div>
            <div
              className="text-sm font-medium"
              style={{
                color:
                  status === 'on'
                    ? 'var(--accent)'
                    : status === 'error'
                      ? 'var(--red)'
                      : 'var(--text-3)',
              }}
            >
              {status === 'on'
                ? 'Синхронизация активна'
                : status === 'error'
                  ? 'Ошибка'
                  : 'Отключено'}
            </div>
            {lastSync && (
              <div
                className="text-xs mt-0.5"
                style={{ color: 'var(--text-3)' }}
              >
                Последняя синхр.: {lastSync}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleToggle}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: syncEnabled ? 'var(--red-soft)' : 'var(--accent-soft)',
            border: `1px solid ${syncEnabled ? 'rgba(248,113,113,0.3)' : 'var(--accent-border)'}`,
            color: syncEnabled ? 'var(--red)' : 'var(--accent)',
          }}
        >
          {syncEnabled ? 'Отключить' : 'Включить'}
        </button>
      </div>

      {/* Поля */}
      <div className="space-y-3">
        <div>
          <label
            className="block text-xs font-mono mb-1.5"
            style={{ color: 'var(--text-3)' }}
          >
            Supabase URL
          </label>
          <input
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
            placeholder="https://xxxxxxxx.supabase.co"
            className={inpCls}
            style={inpStyle}
          />
        </div>
        <div>
          <label
            className="block text-xs font-mono mb-1.5"
            style={{ color: 'var(--text-3)' }}
          >
            Supabase Anon Key
          </label>
          <input
            type="password"
            value={supabaseKey}
            onChange={(e) => setSupabaseKey(e.target.value)}
            placeholder="eyJhbGci..."
            className={inpCls}
            style={inpStyle}
          />
        </div>
        <div className="text-xs px-1" style={{ color: 'var(--text-4)' }}>
          PowerSync URL больше не нужен — синхронизация идёт напрямую через
          Supabase
        </div>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{
          background: saved ? 'var(--accent-soft)' : 'var(--surface2)',
          border: `1px solid ${saved ? 'var(--accent-border)' : 'var(--border-md)'}`,
          color: saved ? 'var(--accent)' : 'var(--text-2)',
        }}
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" />
            Сохранено
          </>
        ) : (
          'Сохранить'
        )}
      </button>
    </div>
  );
}
