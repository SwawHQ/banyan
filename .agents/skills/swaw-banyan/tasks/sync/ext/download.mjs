const timeoutMs = 20_000;

export async function downloadResource(source, id) {
  try {
    const response = await fetch(source,{
      signal:AbortSignal.timeout(timeoutMs),
      headers:{accept:'*/*','user-agent':'banyan-external-resource-sync'}
    });
    if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const reason = error.name === 'TimeoutError' ? 'fetch timed out after ' + timeoutMs + 'ms' : error.message;
    throw new Error(id + ': fetch failed: ' + reason);
  }
}
