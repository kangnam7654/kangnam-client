use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::providers::types::*;
use crate::state::AppState;

// System prompts embedded at compile time from prompt files
const GENERATE_SYSTEM: &str = include_str!("../../prompts/generate.md");
const IMPROVE_SYSTEM: &str = include_str!("../../prompts/improve.md");
const GENERATE_REFS_SYSTEM: &str = include_str!("../../prompts/generate_refs.md");
const EVAL_SYSTEM: &str = include_str!("../../prompts/eval.md");
const GRADER_SYSTEM: &str = include_str!("../../prompts/grader.md");
const COMPARATOR_SYSTEM: &str = include_str!("../../prompts/comparator.md");
const ANALYZER_SYSTEM: &str = include_str!("../../prompts/analyzer.md");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedSkill {
    pub name: String,
    pub description: String,
    pub instructions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedRef {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalTestCase {
    pub prompt: String,
    #[serde(rename = "expectedBehavior")]
    pub expected_behavior: String,
    #[serde(rename = "shouldTrigger")]
    pub should_trigger: bool,
}

/// Call LLM and collect full text response.
pub async fn call_llm(
    provider_name: &str,
    state: &AppState,
    app: &AppHandle,
    messages: Vec<ChatMessage>,
    model: Option<&str>,
) -> Result<String, String> {
    let access_token = state
        .auth
        .get_access_token(provider_name, &state.db, app)
        .await
        .ok_or(format!("Not connected to {provider_name}"))?;

    let provider = state
        .router
        .get_provider(provider_name)
        .ok_or(format!("Unknown provider: {provider_name}"))?;

    let (tx, mut rx) = tokio::sync::mpsc::channel::<StreamEvent>(64);
    let msgs = messages.clone();
    let token = access_token.clone();
    let mdl = model.map(|s| s.to_string());

    tokio::spawn(async move {
        let _ = provider
            .send_message(&msgs, &[], &token, tx, mdl.as_deref(), None)
            .await;
    });

    let mut result = String::new();
    while let Some(event) = rx.recv().await {
        if let StreamEvent::Token(text) = event {
            result.push_str(&text);
        }
    }

    Ok(result.trim().to_string())
}

/// Strip markdown fences if present.
pub fn extract_json(text: &str) -> &str {
    if let Some(start) = text.find("```") {
        let after_fence = start + 3;
        if let Some(end) = text[after_fence..].find("```") {
            let inner = &text[after_fence..after_fence + end];
            // Skip language identifier line (e.g. "json\n")
            return if let Some(stripped) = inner.strip_prefix("json") {
                stripped.trim()
            } else {
                inner.trim()
            };
        }
    }
    text.trim()
}

/// Parse JSON safely with error context.
pub fn parse_json_response<T: serde::de::DeserializeOwned>(raw: &str) -> Result<T, String> {
    let cleaned = extract_json(raw);
    serde_json::from_str(cleaned).map_err(|e| {
        format!(
            "Failed to parse AI response as JSON: {e}\n\nRaw: {}",
            &raw[..raw.len().min(500)]
        )
    })
}

fn make_msg(role: &str, content: &str) -> ChatMessage {
    ChatMessage {
        role: role.to_string(),
        content: content.to_string(),
        tool_call_id: None,
        tool_use_id: None,
        images: None,
        tool_calls: None,
    }
}

/// Generate a new skill from a user's natural language description.
pub async fn generate_skill(
    user_request: &str,
    provider: &str,
    model: Option<&str>,
    state: &AppState,
    app: &AppHandle,
) -> Result<GeneratedSkill, String> {
    let messages = vec![
        make_msg("system", GENERATE_SYSTEM),
        make_msg("user", user_request),
    ];
    let raw = call_llm(provider, state, app, messages, model).await?;
    let json: GeneratedSkill = parse_json_response(&raw)?;
    Ok(GeneratedSkill {
        name: json.name,
        description: json.description,
        instructions: json.instructions,
    })
}

/// Improve an existing skill based on user feedback.
pub async fn improve_skill(
    current: &serde_json::Value,
    feedback: &str,
    provider: &str,
    model: Option<&str>,
    state: &AppState,
    app: &AppHandle,
) -> Result<GeneratedSkill, String> {
    let name = current
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let description = current
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let instructions = current
        .get("instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let user_content = format!(
        "## Current Skill\n\n**Name:** {name}\n**Description:** {description}\n\n**Instructions:**\n{instructions}\n\n---\n\n## Feedback\n{feedback}"
    );
    let messages = vec![
        make_msg("system", IMPROVE_SYSTEM),
        make_msg("user", &user_content),
    ];
    let raw = call_llm(provider, state, app, messages, model).await?;
    let json: GeneratedSkill = parse_json_response(&raw)?;
    Ok(GeneratedSkill {
        name: if json.name.is_empty() {
            name.to_string()
        } else {
            json.name
        },
        description: if json.description.is_empty() {
            description.to_string()
        } else {
            json.description
        },
        instructions: if json.instructions.is_empty() {
            instructions.to_string()
        } else {
            json.instructions
        },
    })
}

/// Generate reference material for a skill.
pub async fn generate_reference(
    skill_instructions: &str,
    user_request: &str,
    provider: &str,
    model: Option<&str>,
    state: &AppState,
    app: &AppHandle,
) -> Result<GeneratedRef, String> {
    let content = format!(
        "## Skill Instructions\n{skill_instructions}\n\n---\n\n## Request\n{user_request}"
    );
    let messages = vec![
        make_msg("system", GENERATE_REFS_SYSTEM),
        make_msg("user", &content),
    ];
    let raw = call_llm(provider, state, app, messages, model).await?;
    let json: GeneratedRef = parse_json_response(&raw)?;
    Ok(GeneratedRef {
        name: if json.name.is_empty() {
            "Reference".to_string()
        } else {
            json.name
        },
        content: json.content,
    })
}

/// Generate eval test cases for a skill.
pub async fn generate_evals(
    skill: &serde_json::Value,
    provider: &str,
    model: Option<&str>,
    state: &AppState,
    app: &AppHandle,
) -> Result<Vec<EvalTestCase>, String> {
    let name = skill.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let description = skill
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let instructions = skill
        .get("instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let content = format!(
        "## Skill\n\n**Name:** {name}\n**Description:** {description}\n\n**Instructions:**\n{instructions}"
    );
    let messages = vec![
        make_msg("system", EVAL_SYSTEM),
        make_msg("user", &content),
    ];
    let raw = call_llm(provider, state, app, messages, model).await?;

    #[derive(Deserialize)]
    struct Wrapper {
        #[serde(rename = "testCases")]
        test_cases: Vec<EvalTestCase>,
    }
    let wrapper: Wrapper = parse_json_response(&raw)?;
    Ok(wrapper.test_cases)
}

/// Grade a skill against quality criteria (Grader sub-agent).
pub async fn grade_skill(
    skill: &serde_json::Value,
    criteria: &[String],
    provider: &str,
    model: Option<&str>,
    state: &AppState,
    app: &AppHandle,
) -> Result<serde_json::Value, String> {
    let name = skill.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let description = skill
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let instructions = skill
        .get("instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let criteria_text: String = criteria
        .iter()
        .enumerate()
        .map(|(i, c)| format!("{}. {c}", i + 1))
        .collect::<Vec<_>>()
        .join("\n");
    let content = format!(
        "## Skill to Grade\n\n**Name:** {name}\n**Description:** {description}\n\n**Instructions:**\n{instructions}\n\n---\n\n## Criteria\n{criteria_text}"
    );
    let messages = vec![
        make_msg("system", GRADER_SYSTEM),
        make_msg("user", &content),
    ];
    let raw = call_llm(provider, state, app, messages, model).await?;
    parse_json_response(&raw)
}

/// Blind comparison of two skill versions (Comparator sub-agent).
pub async fn compare_skills(
    skill_a: &serde_json::Value,
    skill_b: &serde_json::Value,
    provider: &str,
    model: Option<&str>,
    state: &AppState,
    app: &AppHandle,
) -> Result<serde_json::Value, String> {
    // Randomly assign to A/B to prevent position bias
    let swapped = rand::random::<bool>();
    let (a, b) = if swapped {
        (skill_b, skill_a)
    } else {
        (skill_a, skill_b)
    };

    let a_name = a.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let a_desc = a.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let a_inst = a
        .get("instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let b_name = b.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let b_desc = b.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let b_inst = b
        .get("instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let content = format!(
        "## Skill Version A\n\n**Name:** {a_name}\n**Description:** {a_desc}\n\n**Instructions:**\n{a_inst}\n\n---\n\n## Skill Version B\n\n**Name:** {b_name}\n**Description:** {b_desc}\n\n**Instructions:**\n{b_inst}"
    );
    let messages = vec![
        make_msg("system", COMPARATOR_SYSTEM),
        make_msg("user", &content),
    ];
    let raw = call_llm(provider, state, app, messages, model).await?;
    let mut result: serde_json::Value = parse_json_response(&raw)?;

    // Attach mapping so caller knows which was which
    if let Some(obj) = result.as_object_mut() {
        obj.insert(
            "mapping".to_string(),
            serde_json::json!({
                "A": if swapped { "second" } else { "first" },
                "B": if swapped { "first" } else { "second" }
            }),
        );
    }
    Ok(result)
}

/// Analyze comparison results (Analyzer sub-agent).
pub async fn analyze_comparison(
    comparison_result: &serde_json::Value,
    winner: &serde_json::Value,
    loser: &serde_json::Value,
    provider: &str,
    model: Option<&str>,
    state: &AppState,
    app: &AppHandle,
) -> Result<serde_json::Value, String> {
    let comp_winner = comparison_result
        .get("winner")
        .and_then(|v| v.as_str())
        .unwrap_or("?");
    let comp_reasoning = comparison_result
        .get("reasoning")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let w_name = winner.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let w_desc = winner
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let w_inst = winner
        .get("instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let l_name = loser.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let l_desc = loser
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let l_inst = loser
        .get("instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let content = format!(
        "## Blind Comparison Result\n\n**Winner:** {comp_winner}\n**Reasoning:** {comp_reasoning}\n\n---\n\n## Winner Skill\n\n**Name:** {w_name}\n**Description:** {w_desc}\n\n**Instructions:**\n{w_inst}\n\n---\n\n## Loser Skill\n\n**Name:** {l_name}\n**Description:** {l_desc}\n\n**Instructions:**\n{l_inst}"
    );
    let messages = vec![
        make_msg("system", ANALYZER_SYSTEM),
        make_msg("user", &content),
    ];
    let raw = call_llm(provider, state, app, messages, model).await?;
    parse_json_response(&raw)
}
