// Google Drive service — authentication + API helpers for Cash chatbot

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Google OAuth error: ${data.error} — ${data.error_description}`);
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

export async function searchFiles(query, maxResults = 10) {
  try {
    const accessToken = await getAccessToken();
    const q = `(fullText contains '${query}' or name contains '${query}') and trashed = false`;
    const params = new URLSearchParams({
      q,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime, parents, size)',
      pageSize: String(maxResults),
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      corpora: 'allDrives',
    });

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Drive API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return (data.files || []).map(f => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink,
      modifiedTime: f.modifiedTime,
    }));
  } catch (err) {
    return { error: `Failed to search Drive: ${err.message}` };
  }
}

export async function readFileContent(fileId, mimeType) {
  try {
    const accessToken = await getAccessToken();
    let url;
    let exportMime;

    if (mimeType === 'application/vnd.google-apps.document') {
      exportMime = 'text/plain';
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}&supportsAllDrives=true`;
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      exportMime = 'text/csv';
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}&supportsAllDrives=true`;
    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      exportMime = 'text/plain';
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}&supportsAllDrives=true`;
    } else if (
      mimeType === 'application/pdf' ||
      mimeType?.startsWith('image/') ||
      mimeType === 'application/zip' ||
      mimeType === 'application/octet-stream'
    ) {
      return {
        content: "This is a binary file (PDF, image, etc.) — I can't read its contents directly, but I can share the link.",
        mimeType,
      };
    } else {
      // Plain text or other text-based files
      url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Drive API error (${response.status}): ${errText}`);
    }

    let content = await response.text();
    const MAX_LENGTH = 15000;
    if (content.length > MAX_LENGTH) {
      content = content.slice(0, MAX_LENGTH) + "\n\n[Content truncated — document is longer than what's shown here]";
    }

    return { content, mimeType };
  } catch (err) {
    return { error: `Failed to read file: ${err.message}` };
  }
}

export async function getFileLink(fileId) {
  try {
    const accessToken = await getAccessToken();
    const params = new URLSearchParams({
      fields: 'webViewLink,name',
      supportsAllDrives: 'true',
    });

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Drive API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return { name: data.name, webViewLink: data.webViewLink };
  } catch (err) {
    return { error: `Failed to get file link: ${err.message}` };
  }
}
