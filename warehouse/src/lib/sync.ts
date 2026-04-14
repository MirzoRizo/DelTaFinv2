// src/lib/sync.ts
// Упрощённая синхронизация через Supabase REST API
// Без PowerSync SDK — напрямую через fetch

let syncInterval: ReturnType<typeof setInterval> | null = null;
let lastSyncAt = 0;

function getConfig() {
  return {
    supabaseUrl: localStorage.getItem('sync_supabase_url') ?? '',
    supabaseKey: localStorage.getItem('sync_supabase_key') ?? '',
  };
}

// Загружаем данные из Supabase в локальный SQLite
async function pullFromSupabase() {
  const { supabaseUrl, supabaseKey } = getConfig();
  if (!supabaseUrl || !supabaseKey) return;

  const { getDb } = await import('../db/index');
  const db = await getDb();

  const tables = [
    'categories',
    'units',
    'products',
    'movements',
    'suppliers',
    'invoices',
    'invoice_items',
  ];

  for (const table of tables) {
    try {
      const url =
        lastSyncAt > 0
          ? `${supabaseUrl}/rest/v1/${table}?updated_at=gt.${lastSyncAt}&order=updated_at.asc`
          : `${supabaseUrl}/rest/v1/${table}?order=updated_at.asc`;

      const res = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (!res.ok) continue;
      const rows: Record<string, unknown>[] = await res.json();

      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const placeholders = cols.map(() => '?').join(',');
        const updates = cols
          .filter((c) => c !== 'id')
          .map((c) => `${c}=excluded.${c}`)
          .join(',');

        await db.execute(
          `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})
           ON CONFLICT(id) DO UPDATE SET ${updates}`,
          vals,
        );
      }
    } catch {
      // таблица может не иметь updated_at — пропускаем
    }
  }

  lastSyncAt = Date.now();
}

// Отправляем локальные изменения в Supabase
export async function pushToSupabase(
  table: string,
  row: Record<string, unknown>,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
) {
  const { supabaseUrl, supabaseKey } = getConfig();
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const url =
      method === 'PATCH' || method === 'DELETE'
        ? `${supabaseUrl}/rest/v1/${table}?id=eq.${row.id}`
        : `${supabaseUrl}/rest/v1/${table}`;

    await fetch(url, {
      method,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: method !== 'DELETE' ? JSON.stringify(row) : undefined,
    });
  } catch (e) {
    console.error('Sync push error:', e);
  }
}

// Запустить синхронизацию (пуллинг каждые 10 секунд)
export async function startSync(): Promise<void> {
  if (syncInterval) return;
  await pullFromSupabase();
  syncInterval = setInterval(pullFromSupabase, 10000);
}

export function stopSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export function getSyncStatus() {
  return {
    connected: syncInterval !== null,
    lastSyncAt,
  };
}
