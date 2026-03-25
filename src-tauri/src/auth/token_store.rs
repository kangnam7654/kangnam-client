use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "kangnam-client";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredToken {
    pub provider: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub metadata: Option<serde_json::Value>,
}

/// Save a token — access_token and refresh_token go to OS keychain, metadata to SQLite.
pub fn save_token(conn: &Connection, token: &StoredToken) {
    // Store access_token in OS keychain
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-access", token.provider)) {
        let _ = entry.set_password(&token.access_token);
    }

    // Store refresh_token in OS keychain
    if let Some(ref rt) = token.refresh_token {
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-refresh", token.provider)) {
            let _ = entry.set_password(rt);
        }
    }

    // Store only metadata + expiry in SQLite (no secrets)
    let metadata_str = token.metadata.as_ref().map(|m| serde_json::to_string(m).unwrap_or_default());
    conn.execute(
        "INSERT OR REPLACE INTO auth_tokens (provider, access_token, refresh_token, expires_at, metadata) VALUES (?1, '[keychain]', NULL, ?2, ?3)",
        params![token.provider, token.expires_at, metadata_str],
    ).ok();
}

/// Get a token — reads access_token and refresh_token from OS keychain, metadata from SQLite.
pub fn get_token(conn: &Connection, provider: &str) -> Option<StoredToken> {
    let mut token = conn.query_row(
        "SELECT provider, access_token, refresh_token, expires_at, metadata FROM auth_tokens WHERE provider = ?1",
        params![provider],
        |row| {
            let metadata_str: Option<String> = row.get(4)?;
            let metadata = metadata_str.and_then(|s| serde_json::from_str(&s).ok());
            Ok(StoredToken {
                provider: row.get(0)?,
                access_token: row.get(1)?,
                refresh_token: row.get(2)?,
                expires_at: row.get(3)?,
                metadata,
            })
        },
    ).ok()?;

    // Retrieve access_token from OS keychain
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-access", provider)) {
        if let Ok(at) = entry.get_password() {
            token.access_token = at;
        }
    }

    // Retrieve refresh_token from OS keychain
    if token.refresh_token.is_none() {
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-refresh", provider)) {
            if let Ok(rt) = entry.get_password() {
                token.refresh_token = Some(rt);
            }
        }
    }

    Some(token)
}

/// Delete a token from both SQLite and OS keychain.
pub fn delete_token(conn: &Connection, provider: &str) {
    conn.execute("DELETE FROM auth_tokens WHERE provider = ?1", params![provider]).ok();

    // Remove access_token from keychain
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-access", provider)) {
        let _ = entry.delete_credential();
    }
    // Remove refresh_token from keychain
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &format!("{}-refresh", provider)) {
        let _ = entry.delete_credential();
    }
}

/// List all providers that have stored tokens.
pub fn list_token_providers(conn: &Connection) -> Vec<String> {
    let Ok(mut stmt) = conn.prepare("SELECT provider FROM auth_tokens") else {
        return vec![];
    };
    let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) else {
        return vec![];
    };
    rows.filter_map(|r| r.ok()).collect()
}
