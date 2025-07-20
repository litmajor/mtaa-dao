// Simple API client for user settings endpoints
export async function apiGet(path: string) {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path: string, body: any) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPut(path: string, body: any) {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path: string) {
  const res = await fetch(path, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
