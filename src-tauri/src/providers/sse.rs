/// Parse an SSE event block into event name and data.
pub fn parse_sse_event(block: &str) -> (Option<String>, String) {
    let mut event = None;
    let mut data_lines = Vec::new();

    for line in block.lines() {
        if let Some(rest) = line.strip_prefix("event:") {
            event = Some(rest.trim().to_string());
        } else if let Some(rest) = line.strip_prefix("data:") {
            data_lines.push(rest.trim_start().to_string());
        }
    }

    (event, data_lines.join("\n"))
}

/// Split a byte buffer into SSE event blocks, returning (events, remaining_buffer).
pub fn split_sse_events(buffer: &str) -> (Vec<String>, String) {
    let mut events = Vec::new();
    let parts: Vec<&str> = buffer.split("\n\n").collect();

    if parts.is_empty() {
        return (events, String::new());
    }

    // Last part is the remaining buffer (may be incomplete)
    let remaining = parts.last().unwrap().to_string();

    for part in &parts[..parts.len() - 1] {
        let trimmed = part.trim();
        if !trimmed.is_empty() {
            events.push(trimmed.to_string());
        }
    }

    (events, remaining)
}

/// Split a byte buffer on newlines (for line-delimited SSE like OpenAI).
pub fn split_lines(buffer: &str) -> (Vec<String>, String) {
    let mut lines = Vec::new();
    let parts: Vec<&str> = buffer.split('\n').collect();

    if parts.is_empty() {
        return (lines, String::new());
    }

    let remaining = parts.last().unwrap().to_string();

    for part in &parts[..parts.len() - 1] {
        lines.push(part.to_string());
    }

    (lines, remaining)
}
