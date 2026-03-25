use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub instructions: String,
    pub model: Option<String>,
    #[serde(rename = "allowedTools")]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(rename = "maxTurns")]
    pub max_turns: i64,
    #[serde(rename = "sortOrder")]
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRun {
    pub id: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "conversationId")]
    pub conversation_id: String,
    pub task: String,
    pub result: Option<String>,
    #[serde(rename = "modelUsed")]
    pub model_used: Option<String>,
    pub status: String,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
}

pub fn list_agents(conn: &Connection) -> Result<Vec<Agent>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, instructions, model, allowed_tools, max_turns, sort_order \
         FROM agents ORDER BY sort_order ASC, name ASC",
    )?;
    let agents = stmt
        .query_map([], |row| {
            let tools_json: Option<String> = row.get(5)?;
            let allowed_tools: Option<Vec<String>> = tools_json
                .and_then(|s| serde_json::from_str(&s).ok());
            Ok(Agent {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                instructions: row.get(3)?,
                model: row.get(4)?,
                allowed_tools,
                max_turns: row.get(6)?,
                sort_order: row.get(7)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
    Ok(agents)
}

pub fn get_agent(conn: &Connection, id: &str) -> Option<Agent> {
    conn.query_row(
        "SELECT id, name, description, instructions, model, allowed_tools, max_turns, sort_order \
         FROM agents WHERE id = ?1",
        params![id],
        |row| {
            let tools_json: Option<String> = row.get(5)?;
            let allowed_tools: Option<Vec<String>> = tools_json
                .and_then(|s| serde_json::from_str(&s).ok());
            Ok(Agent {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                instructions: row.get(3)?,
                model: row.get(4)?,
                allowed_tools,
                max_turns: row.get(6)?,
                sort_order: row.get(7)?,
            })
        },
    )
    .ok()
}

pub fn create_agent(
    conn: &Connection,
    name: &str,
    description: &str,
    instructions: &str,
    model: Option<&str>,
    allowed_tools: Option<Vec<String>>,
    max_turns: i64,
) -> Result<Agent, rusqlite::Error> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let tools_json = allowed_tools.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());
    conn.execute(
        "INSERT INTO agents (id, name, description, instructions, model, allowed_tools, max_turns, sort_order, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9)",
        params![id, name, description, instructions, model, tools_json, max_turns, now, now],
    )?;
    Ok(Agent {
        id,
        name: name.to_string(),
        description: description.to_string(),
        instructions: instructions.to_string(),
        model: model.map(|s| s.to_string()),
        allowed_tools,
        max_turns,
        sort_order: 0,
    })
}

pub fn update_agent(
    conn: &Connection,
    id: &str,
    name: &str,
    description: &str,
    instructions: &str,
    model: Option<&str>,
    allowed_tools: Option<Vec<String>>,
    max_turns: i64,
) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().timestamp();
    let tools_json = allowed_tools.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());
    conn.execute(
        "UPDATE agents SET name = ?1, description = ?2, instructions = ?3, \
         model = ?4, allowed_tools = ?5, max_turns = ?6, updated_at = ?7 WHERE id = ?8",
        params![name, description, instructions, model, tools_json, max_turns, now, id],
    )?;
    Ok(())
}

pub fn delete_agent(conn: &Connection, id: &str) {
    conn.execute("DELETE FROM agents WHERE id = ?1", params![id]).ok();
}

// ── Agent Runs ──

pub fn create_agent_run(
    conn: &Connection,
    agent_id: &str,
    conversation_id: &str,
    task: &str,
) -> Result<AgentRun, rusqlite::Error> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO agent_runs (id, agent_id, conversation_id, task, status, started_at) \
         VALUES (?1, ?2, ?3, ?4, 'running', ?5)",
        params![id, agent_id, conversation_id, task, now],
    )?;
    Ok(AgentRun {
        id,
        agent_id: agent_id.to_string(),
        conversation_id: conversation_id.to_string(),
        task: task.to_string(),
        result: None,
        model_used: None,
        status: "running".to_string(),
        started_at: now,
        completed_at: None,
    })
}

pub fn complete_agent_run(
    conn: &Connection,
    run_id: &str,
    result: &str,
    model_used: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE agent_runs SET result = ?1, model_used = ?2, status = 'completed', completed_at = ?3 WHERE id = ?4",
        params![result, model_used, now, run_id],
    )?;
    Ok(())
}

pub fn fail_agent_run(
    conn: &Connection,
    run_id: &str,
    error: &str,
) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE agent_runs SET result = ?1, status = 'failed', completed_at = ?2 WHERE id = ?3",
        params![error, now, run_id],
    )?;
    Ok(())
}
