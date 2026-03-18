use rusqlite::{Connection, Result};
use std::path::Path;

/// Open a database connection with WAL mode enabled
pub fn open_database(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(conn)
}
