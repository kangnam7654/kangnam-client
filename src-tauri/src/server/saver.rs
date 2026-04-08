use std::sync::Arc;
use crate::cli::types::UnifiedMessage;
use crate::db::conversations;
use crate::state::AppState;

/// Background task that listens to broadcast and saves assistant messages to DB.
/// Collects TextDelta chunks and writes them to DB when TurnEnd arrives.
pub fn start_message_saver(state: Arc<AppState>) {
    let mut rx = state.broadcast_tx.subscribe();

    tokio::spawn(async move {
        let mut text_buffer = String::new();
        // TODO: track session_id per turn for proper conversation mapping
        // For now, we use the latest session from the DB

        loop {
            match rx.recv().await {
                Ok(notification) => {
                    if notification.method != "cli.stream" {
                        continue;
                    }

                    let params = match notification.params {
                        Some(ref p) => p,
                        None => continue,
                    };

                    // Try to parse as UnifiedMessage
                    let msg: UnifiedMessage = match serde_json::from_value(params.clone()) {
                        Ok(m) => m,
                        Err(_) => continue,
                    };

                    match msg {
                        UnifiedMessage::TextDelta { ref text } => {
                            text_buffer.push_str(text);
                        }
                        UnifiedMessage::TurnEnd { .. } => {
                            if !text_buffer.trim().is_empty() {
                                // Save accumulated assistant text to DB
                                if let Ok(db) = state.db.lock() {
                                    // Get the most recent conversation
                                    if let Ok(convs) = conversations::list_conversations(&db) {
                                        if let Some(conv) = convs.first() {
                                            let _ = conversations::add_message(
                                                &db,
                                                &conv.id,
                                                "assistant",
                                                &text_buffer,
                                                None, None, None, None, None,
                                            );
                                        }
                                    }
                                }
                            }
                            text_buffer.clear();
                        }
                        // Other message types — don't accumulate
                        _ => {}
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    eprintln!("[saver] Dropped {} messages (lagged)", n);
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    break;
                }
            }
        }
    });
}
