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

    let remaining = parts.last().unwrap_or(&"").to_string();

    for part in &parts[..parts.len() - 1] {
        lines.push(part.to_string());
    }

    (lines, remaining)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── parse_sse_event ──

    #[test]
    fn parse_basic_data_event() {
        let (event, data) = parse_sse_event("data: hello world");
        assert_eq!(event, None);
        assert_eq!(data, "hello world");
    }

    #[test]
    fn parse_named_event() {
        let (event, data) = parse_sse_event("event: message\ndata: {\"text\": \"hi\"}");
        assert_eq!(event, Some("message".to_string()));
        assert_eq!(data, "{\"text\": \"hi\"}");
    }

    #[test]
    fn parse_multiline_data() {
        let (event, data) = parse_sse_event("data: line1\ndata: line2\ndata: line3");
        assert_eq!(event, None);
        assert_eq!(data, "line1\nline2\nline3");
    }

    #[test]
    fn parse_empty_data() {
        let (event, data) = parse_sse_event("data:");
        assert_eq!(event, None);
        assert_eq!(data, "");
    }

    #[test]
    fn parse_event_only() {
        let (event, data) = parse_sse_event("event: done");
        assert_eq!(event, Some("done".to_string()));
        assert_eq!(data, "");
    }

    #[test]
    fn parse_ignores_comments_and_unknown_fields() {
        let (event, data) = parse_sse_event(": comment\nid: 123\ndata: actual");
        assert_eq!(event, None);
        assert_eq!(data, "actual");
    }

    // ── split_sse_events ──

    #[test]
    fn split_single_complete_event() {
        let (events, remaining) = split_sse_events("data: hello\n\n");
        assert_eq!(events, vec!["data: hello"]);
        assert_eq!(remaining, "");
    }

    #[test]
    fn split_multiple_events() {
        let (events, remaining) = split_sse_events("data: one\n\ndata: two\n\n");
        assert_eq!(events, vec!["data: one", "data: two"]);
        assert_eq!(remaining, "");
    }

    #[test]
    fn split_incomplete_event_in_buffer() {
        let (events, remaining) = split_sse_events("data: one\n\ndata: partial");
        assert_eq!(events, vec!["data: one"]);
        assert_eq!(remaining, "data: partial");
    }

    #[test]
    fn split_no_complete_events() {
        let (events, remaining) = split_sse_events("data: still waiting");
        assert!(events.is_empty());
        assert_eq!(remaining, "data: still waiting");
    }

    #[test]
    fn split_empty_buffer() {
        let (events, remaining) = split_sse_events("");
        assert!(events.is_empty());
        assert_eq!(remaining, "");
    }

    // ── split_lines ──

    #[test]
    fn split_lines_basic() {
        let (lines, remaining) = split_lines("line1\nline2\npartial");
        assert_eq!(lines, vec!["line1", "line2"]);
        assert_eq!(remaining, "partial");
    }

    #[test]
    fn split_lines_trailing_newline() {
        let (lines, remaining) = split_lines("line1\nline2\n");
        assert_eq!(lines, vec!["line1", "line2"]);
        assert_eq!(remaining, "");
    }

    #[test]
    fn split_lines_empty() {
        let (lines, remaining) = split_lines("");
        assert!(lines.is_empty());
        assert_eq!(remaining, "");
    }

    #[test]
    fn split_lines_no_newline() {
        let (lines, remaining) = split_lines("incomplete");
        assert!(lines.is_empty());
        assert_eq!(remaining, "incomplete");
    }
}
