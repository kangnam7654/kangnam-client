// Auto-generated file: skill-creator asset contents embedded as constants.
// Source: /Users/kangnam/projects/ai-config-sync/claude-code/skills/skill-creator/
// Do not edit manually.

/* eslint-disable no-useless-escape */

export const EVAL_REVIEW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eval Set Review - __SKILL_NAME_PLACEHOLDER__</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600&family=Lora:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Lora', Georgia, serif; background: #faf9f5; padding: 2rem; color: #141413; }
    h1 { font-family: 'Poppins', sans-serif; margin-bottom: 0.5rem; font-size: 1.5rem; }
    .description { color: #b0aea5; margin-bottom: 1.5rem; font-style: italic; max-width: 900px; }
    .controls { margin-bottom: 1rem; display: flex; gap: 0.5rem; }
    .btn { font-family: 'Poppins', sans-serif; padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-weight: 500; }
    .btn-add { background: #6a9bcc; color: white; }
    .btn-add:hover { background: #5889b8; }
    .btn-export { background: #d97757; color: white; }
    .btn-export:hover { background: #c4613f; }
    table { width: 100%; max-width: 1100px; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    th { font-family: 'Poppins', sans-serif; background: #141413; color: #faf9f5; padding: 0.75rem 1rem; text-align: left; font-size: 0.875rem; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #e8e6dc; vertical-align: top; }
    tr:nth-child(even) td { background: #faf9f5; }
    tr:hover td { background: #f3f1ea; }
    .section-header td { background: #e8e6dc; font-family: 'Poppins', sans-serif; font-weight: 500; font-size: 0.8rem; color: #141413; text-transform: uppercase; letter-spacing: 0.05em; }
    .query-input { width: 100%; padding: 0.4rem; border: 1px solid #e8e6dc; border-radius: 4px; font-size: 0.875rem; font-family: 'Lora', Georgia, serif; resize: vertical; min-height: 60px; }
    .query-input:focus { outline: none; border-color: #d97757; box-shadow: 0 0 0 2px rgba(217,119,87,0.15); }
    .toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle .slider { position: absolute; inset: 0; background: #b0aea5; border-radius: 24px; cursor: pointer; transition: 0.2s; }
    .toggle .slider::before { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s; }
    .toggle input:checked + .slider { background: #d97757; }
    .toggle input:checked + .slider::before { transform: translateX(20px); }
    .btn-delete { background: #c44; color: white; padding: 0.3rem 0.6rem; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-family: 'Poppins', sans-serif; }
    .btn-delete:hover { background: #a33; }
    .summary { margin-top: 1rem; color: #b0aea5; font-size: 0.875rem; }
  </style>
</head>
<body>
  <h1>Eval Set Review: <span id="skill-name">__SKILL_NAME_PLACEHOLDER__</span></h1>
  <p class="description">Current description: <span id="skill-desc">__SKILL_DESCRIPTION_PLACEHOLDER__</span></p>

  <div class="controls">
    <button class="btn btn-add" onclick="addRow()">+ Add Query</button>
    <button class="btn btn-export" onclick="exportEvalSet()">Export Eval Set</button>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:65%">Query</th>
        <th style="width:18%">Should Trigger</th>
        <th style="width:10%">Actions</th>
      </tr>
    </thead>
    <tbody id="eval-body"></tbody>
  </table>

  <p class="summary" id="summary"></p>

  <script>
    const EVAL_DATA = __EVAL_DATA_PLACEHOLDER__;

    let evalItems = [...EVAL_DATA];

    function render() {
      const tbody = document.getElementById('eval-body');
      tbody.innerHTML = '';

      // Sort: should-trigger first, then should-not-trigger
      const sorted = evalItems
        .map((item, origIdx) => ({ ...item, origIdx }))
        .sort((a, b) => (b.should_trigger ? 1 : 0) - (a.should_trigger ? 1 : 0));

      let lastGroup = null;
      sorted.forEach(item => {
        const group = item.should_trigger ? 'trigger' : 'no-trigger';
        if (group !== lastGroup) {
          const headerRow = document.createElement('tr');
          headerRow.className = 'section-header';
          headerRow.innerHTML = \`<td colspan="3">\${item.should_trigger ? 'Should Trigger' : 'Should NOT Trigger'}</td>\`;
          tbody.appendChild(headerRow);
          lastGroup = group;
        }

        const idx = item.origIdx;
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td><textarea class="query-input" onchange="updateQuery(\${idx}, this.value)">\${escapeHtml(item.query)}</textarea></td>
          <td>
            <label class="toggle">
              <input type="checkbox" \${item.should_trigger ? 'checked' : ''} onchange="updateTrigger(\${idx}, this.checked)">
              <span class="slider"></span>
            </label>
            <span style="margin-left:8px;font-size:0.8rem;color:#b0aea5">\${item.should_trigger ? 'Yes' : 'No'}</span>
          </td>
          <td><button class="btn-delete" onclick="deleteRow(\${idx})">Delete</button></td>
        \`;
        tbody.appendChild(tr);
      });
      updateSummary();
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function updateQuery(idx, value) { evalItems[idx].query = value; updateSummary(); }
    function updateTrigger(idx, value) { evalItems[idx].should_trigger = value; render(); }
    function deleteRow(idx) { evalItems.splice(idx, 1); render(); }

    function addRow() {
      evalItems.push({ query: '', should_trigger: true });
      render();
      const inputs = document.querySelectorAll('.query-input');
      inputs[inputs.length - 1].focus();
    }

    function updateSummary() {
      const trigger = evalItems.filter(i => i.should_trigger).length;
      const noTrigger = evalItems.filter(i => !i.should_trigger).length;
      document.getElementById('summary').textContent =
        \`\${evalItems.length} queries total: \${trigger} should trigger, \${noTrigger} should not trigger\`;
    }

    function exportEvalSet() {
      const valid = evalItems.filter(i => i.query.trim() !== '');
      const data = valid.map(i => ({ query: i.query.trim(), should_trigger: i.should_trigger }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'eval_set.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    render();
  </script>
</body>
</html>
`

export const VIEWER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eval Review</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600&family=Lora:wght@400;500&display=swap" rel="stylesheet">
  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js" integrity="sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT" crossorigin="anonymous"></script>
  <style>
    :root {
      --bg: #faf9f5;
      --surface: #ffffff;
      --border: #e8e6dc;
      --text: #141413;
      --text-muted: #b0aea5;
      --accent: #d97757;
      --accent-hover: #c4613f;
      --green: #788c5d;
      --green-bg: #eef2e8;
      --red: #c44;
      --red-bg: #fceaea;
      --header-bg: #141413;
      --header-text: #faf9f5;
      --radius: 6px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Lora', Georgia, serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ---- Header ---- */
    .header {
      background: var(--header-bg);
      color: var(--header-text);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .header h1 {
      font-family: 'Poppins', sans-serif;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .header .instructions {
      font-size: 0.8rem;
      opacity: 0.7;
      margin-top: 0.25rem;
    }
    .header .progress {
      font-size: 0.875rem;
      opacity: 0.8;
      text-align: right;
    }

    /* ---- Main content ---- */
    .main {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* ---- Sections ---- */
    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      flex-shrink: 0;
    }
    .section-header {
      font-family: 'Poppins', sans-serif;
      padding: 0.75rem 1rem;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      background: var(--bg);
    }
    .section-body {
      padding: 1rem;
    }

    /* ---- Config badge ---- */
    .config-badge {
      display: inline-block;
      padding: 0.2rem 0.625rem;
      border-radius: 9999px;
      font-family: 'Poppins', sans-serif;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-left: 0.75rem;
      vertical-align: middle;
    }
    .config-badge.config-primary {
      background: rgba(33, 150, 243, 0.12);
      color: #1976d2;
    }
    .config-badge.config-baseline {
      background: rgba(255, 193, 7, 0.15);
      color: #f57f17;
    }

    /* ---- Prompt ---- */
    .prompt-text {
      white-space: pre-wrap;
      font-size: 0.9375rem;
      line-height: 1.6;
    }

    /* ---- Outputs ---- */
    .output-file {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .output-file + .output-file {
      margin-top: 1rem;
    }
    .output-file-header {
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .output-file-header .dl-btn {
      font-size: 0.7rem;
      color: var(--accent);
      text-decoration: none;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-weight: 500;
      opacity: 0.8;
    }
    .output-file-header .dl-btn:hover {
      opacity: 1;
      text-decoration: underline;
    }
    .output-file-content {
      padding: 0.75rem;
      overflow-x: auto;
    }
    .output-file-content pre {
      font-size: 0.8125rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: 'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
    }
    .output-file-content img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }
    .output-file-content iframe {
      width: 100%;
      height: 600px;
      border: none;
    }
    .output-file-content table {
      border-collapse: collapse;
      font-size: 0.8125rem;
      width: 100%;
    }
    .output-file-content table td,
    .output-file-content table th {
      border: 1px solid var(--border);
      padding: 0.375rem 0.5rem;
      text-align: left;
    }
    .output-file-content table th {
      background: var(--bg);
      font-weight: 600;
    }
    .output-file-content .download-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--accent);
      text-decoration: none;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .output-file-content .download-link:hover {
      background: var(--border);
    }
    .empty-state {
      color: var(--text-muted);
      font-style: italic;
      padding: 2rem;
      text-align: center;
    }

    /* ---- Feedback ---- */
    .prev-feedback {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.625rem 0.75rem;
      margin-top: 0.75rem;
      font-size: 0.8125rem;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .prev-feedback-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.25rem;
      color: var(--text-muted);
    }
    .feedback-textarea {
      width: 100%;
      min-height: 100px;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9375rem;
      line-height: 1.5;
      resize: vertical;
      color: var(--text);
    }
    .feedback-textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .feedback-status {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
      min-height: 1.1em;
    }

    /* ---- Grades (collapsible) ---- */
    .grades-toggle {
      display: flex;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }
    .grades-toggle:hover {
      color: var(--accent);
    }
    .grades-toggle .arrow {
      margin-right: 0.5rem;
      transition: transform 0.15s;
      font-size: 0.75rem;
    }
    .grades-toggle .arrow.open {
      transform: rotate(90deg);
    }
    .grades-content {
      display: none;
      margin-top: 0.75rem;
    }
    .grades-content.open {
      display: block;
    }
    .grades-summary {
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .grade-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .grade-pass { background: var(--green-bg); color: var(--green); }
    .grade-fail { background: var(--red-bg); color: var(--red); }
    .assertion-list {
      list-style: none;
    }
    .assertion-item {
      padding: 0.625rem 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.8125rem;
    }
    .assertion-item:last-child { border-bottom: none; }
    .assertion-status {
      font-weight: 600;
      margin-right: 0.5rem;
    }
    .assertion-status.pass { color: var(--green); }
    .assertion-status.fail { color: var(--red); }
    .assertion-evidence {
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-top: 0.25rem;
      padding-left: 1.5rem;
    }

    /* ---- View tabs ---- */
    .view-tabs {
      display: flex;
      gap: 0;
      padding: 0 2rem;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .view-tab {
      font-family: 'Poppins', sans-serif;
      padding: 0.625rem 1.25rem;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      border: none;
      background: none;
      color: var(--text-muted);
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
    }
    .view-tab:hover { color: var(--text); }
    .view-tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    .view-panel { display: none; }
    .view-panel.active { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

    /* ---- Benchmark view ---- */
    .benchmark-view {
      padding: 1.5rem 2rem;
      overflow-y: auto;
      flex: 1;
    }
    .benchmark-table {
      border-collapse: collapse;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      font-size: 0.8125rem;
      width: 100%;
      margin-bottom: 1.5rem;
    }
    .benchmark-table th, .benchmark-table td {
      padding: 0.625rem 0.75rem;
      text-align: left;
      border: 1px solid var(--border);
    }
    .benchmark-table th {
      font-family: 'Poppins', sans-serif;
      background: var(--header-bg);
      color: var(--header-text);
      font-weight: 500;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .benchmark-table tr:hover { background: var(--bg); }
    .benchmark-table tr.benchmark-row-with { background: rgba(33, 150, 243, 0.06); }
    .benchmark-table tr.benchmark-row-without { background: rgba(255, 193, 7, 0.06); }
    .benchmark-table tr.benchmark-row-with:hover { background: rgba(33, 150, 243, 0.12); }
    .benchmark-table tr.benchmark-row-without:hover { background: rgba(255, 193, 7, 0.12); }
    .benchmark-table tr.benchmark-row-avg { font-weight: 600; border-top: 2px solid var(--border); }
    .benchmark-table tr.benchmark-row-avg.benchmark-row-with { background: rgba(33, 150, 243, 0.12); }
    .benchmark-table tr.benchmark-row-avg.benchmark-row-without { background: rgba(255, 193, 7, 0.12); }
    .benchmark-delta-positive { color: var(--green); font-weight: 600; }
    .benchmark-delta-negative { color: var(--red); font-weight: 600; }
    .benchmark-notes {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem;
    }
    .benchmark-notes h3 {
      font-family: 'Poppins', sans-serif;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }
    .benchmark-notes ul {
      list-style: disc;
      padding-left: 1.25rem;
    }
    .benchmark-notes li {
      font-size: 0.8125rem;
      line-height: 1.6;
      margin-bottom: 0.375rem;
    }
    .benchmark-empty {
      color: var(--text-muted);
      font-style: italic;
      text-align: center;
      padding: 3rem;
    }

    /* ---- Navigation ---- */
    .nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      border-top: 1px solid var(--border);
      background: var(--surface);
      flex-shrink: 0;
    }
    .nav-btn {
      font-family: 'Poppins', sans-serif;
      padding: 0.5rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
      transition: all 0.15s;
    }
    .nav-btn:hover:not(:disabled) {
      background: var(--bg);
      border-color: var(--text-muted);
    }
    .nav-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .done-btn {
      font-family: 'Poppins', sans-serif;
      padding: 0.5rem 1.5rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.15s;
    }
    .done-btn:hover {
      background: var(--bg);
      border-color: var(--text-muted);
    }
    .done-btn.ready {
      border: none;
      background: var(--accent);
      color: white;
      font-weight: 600;
    }
    .done-btn.ready:hover {
      background: var(--accent-hover);
    }
    /* ---- Done overlay ---- */
    .done-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 100;
      justify-content: center;
      align-items: center;
    }
    .done-overlay.visible {
      display: flex;
    }
    .done-card {
      background: var(--surface);
      border-radius: 12px;
      padding: 2rem 3rem;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
    }
    .done-card h2 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .done-card p {
      color: var(--text-muted);
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }
    .done-card .btn-row {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
    }
    .done-card button {
      padding: 0.5rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      cursor: pointer;
      font-size: 0.875rem;
    }
    .done-card button:hover {
      background: var(--bg);
    }
    /* ---- Toast ---- */
    .toast {
      position: fixed;
      bottom: 5rem;
      left: 50%;
      transform: translateX(-50%);
      background: var(--header-bg);
      color: var(--header-text);
      padding: 0.625rem 1.25rem;
      border-radius: var(--radius);
      font-size: 0.875rem;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 200;
    }
    .toast.visible {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div id="app" style="height:100vh; display:flex; flex-direction:column;">
    <div class="header">
      <div>
        <h1>Eval Review: <span id="skill-name"></span></h1>
        <div class="instructions">Review each output and leave feedback below. Navigate with arrow keys or buttons. When done, copy feedback and paste into Claude Code.</div>
      </div>
      <div class="progress" id="progress"></div>
    </div>

    <!-- View tabs (only shown when benchmark data exists) -->
    <div class="view-tabs" id="view-tabs" style="display:none;">
      <button class="view-tab active" onclick="switchView('outputs')">Outputs</button>
      <button class="view-tab" onclick="switchView('benchmark')">Benchmark</button>
    </div>

    <!-- Outputs panel (qualitative review) -->
    <div class="view-panel active" id="panel-outputs">
    <div class="main">
      <!-- Prompt -->
      <div class="section">
        <div class="section-header">Prompt <span class="config-badge" id="config-badge" style="display:none;"></span></div>
        <div class="section-body">
          <div class="prompt-text" id="prompt-text"></div>
        </div>
      </div>

      <!-- Outputs -->
      <div class="section">
        <div class="section-header">Output</div>
        <div class="section-body" id="outputs-body">
          <div class="empty-state">No output files found</div>
        </div>
      </div>

      <!-- Previous Output (collapsible) -->
      <div class="section" id="prev-outputs-section" style="display:none;">
        <div class="section-header">
          <div class="grades-toggle" onclick="togglePrevOutputs()">
            <span class="arrow" id="prev-outputs-arrow">&#9654;</span>
            Previous Output
          </div>
        </div>
        <div class="grades-content" id="prev-outputs-content"></div>
      </div>

      <!-- Grades (collapsible) -->
      <div class="section" id="grades-section" style="display:none;">
        <div class="section-header">
          <div class="grades-toggle" onclick="toggleGrades()">
            <span class="arrow" id="grades-arrow">&#9654;</span>
            Formal Grades
          </div>
        </div>
        <div class="grades-content" id="grades-content"></div>
      </div>

      <!-- Feedback -->
      <div class="section">
        <div class="section-header">Your Feedback</div>
        <div class="section-body">
          <textarea
            class="feedback-textarea"
            id="feedback"
            placeholder="What do you think of this output? Any issues, suggestions, or things that look great?"
          ></textarea>
          <div class="feedback-status" id="feedback-status"></div>
          <div class="prev-feedback" id="prev-feedback" style="display:none;">
            <div class="prev-feedback-label">Previous feedback</div>
            <div id="prev-feedback-text"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="nav" id="outputs-nav">
      <button class="nav-btn" id="prev-btn" onclick="navigate(-1)">&#8592; Previous</button>
      <button class="done-btn" id="done-btn" onclick="showDoneDialog()">Submit All Reviews</button>
      <button class="nav-btn" id="next-btn" onclick="navigate(1)">Next &#8594;</button>
    </div>
    </div><!-- end panel-outputs -->

    <!-- Benchmark panel (quantitative stats) -->
    <div class="view-panel" id="panel-benchmark">
      <div class="benchmark-view" id="benchmark-content">
        <div class="benchmark-empty">No benchmark data available. Run a benchmark to see quantitative results here.</div>
      </div>
    </div>
  </div>

  <!-- Done overlay -->
  <div class="done-overlay" id="done-overlay">
    <div class="done-card">
      <h2>Review Complete</h2>
      <p>Your feedback has been saved. Go back to your Claude Code session and tell Claude you're done reviewing.</p>
      <div class="btn-row">
        <button onclick="closeDoneDialog()">OK</button>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" id="toast"></div>

  <script>
    // ---- Embedded data (injected by generate_review.py) ----
    /*__EMBEDDED_DATA__*/

    // ---- State ----
    let feedbackMap = {};  // run_id -> feedback text
    let currentIndex = 0;
    let visitedRuns = new Set();

    // ---- Init ----
    async function init() {
      // Load saved feedback from server — but only if this isn't a fresh
      // iteration (indicated by previous_feedback being present). When
      // previous feedback exists, the feedback.json on disk is stale from
      // the prior iteration and should not pre-fill the textareas.
      const hasPrevious = Object.keys(EMBEDDED_DATA.previous_feedback || {}).length > 0
        || Object.keys(EMBEDDED_DATA.previous_outputs || {}).length > 0;
      if (!hasPrevious) {
        try {
          const resp = await fetch("/api/feedback");
          const data = await resp.json();
          if (data.reviews) {
            for (const r of data.reviews) feedbackMap[r.run_id] = r.feedback;
          }
        } catch { /* first run, no feedback yet */ }
      }

      document.getElementById("skill-name").textContent = EMBEDDED_DATA.skill_name;
      showRun(0);

      // Wire up feedback auto-save
      const textarea = document.getElementById("feedback");
      let saveTimeout = null;
      textarea.addEventListener("input", () => {
        clearTimeout(saveTimeout);
        document.getElementById("feedback-status").textContent = "";
        saveTimeout = setTimeout(() => saveCurrentFeedback(), 800);
      });
    }

    // ---- Navigation ----
    function navigate(delta) {
      const newIndex = currentIndex + delta;
      if (newIndex >= 0 && newIndex < EMBEDDED_DATA.runs.length) {
        saveCurrentFeedback();
        showRun(newIndex);
      }
    }

    function updateNavButtons() {
      document.getElementById("prev-btn").disabled = currentIndex === 0;
      document.getElementById("next-btn").disabled =
        currentIndex === EMBEDDED_DATA.runs.length - 1;
    }

    // ---- Show a run ----
    function showRun(index) {
      currentIndex = index;
      const run = EMBEDDED_DATA.runs[index];

      // Progress
      document.getElementById("progress").textContent =
        \`\${index + 1} of \${EMBEDDED_DATA.runs.length}\`;

      // Prompt
      document.getElementById("prompt-text").textContent = run.prompt;

      // Config badge
      const badge = document.getElementById("config-badge");
      const configMatch = run.id.match(/(with_skill|without_skill|new_skill|old_skill)/);
      if (configMatch) {
        const config = configMatch[1];
        const isBaseline = config === "without_skill" || config === "old_skill";
        badge.textContent = config.replace(/_/g, " ");
        badge.className = "config-badge " + (isBaseline ? "config-baseline" : "config-primary");
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }

      // Outputs
      renderOutputs(run);

      // Previous outputs
      renderPrevOutputs(run);

      // Grades
      renderGrades(run);

      // Previous feedback
      const prevFb = (EMBEDDED_DATA.previous_feedback || {})[run.id];
      const prevEl = document.getElementById("prev-feedback");
      if (prevFb) {
        document.getElementById("prev-feedback-text").textContent = prevFb;
        prevEl.style.display = "block";
      } else {
        prevEl.style.display = "none";
      }

      // Feedback
      document.getElementById("feedback").value = feedbackMap[run.id] || "";
      document.getElementById("feedback-status").textContent = "";

      updateNavButtons();

      // Track visited runs and promote done button when all visited
      visitedRuns.add(index);
      const doneBtn = document.getElementById("done-btn");
      if (visitedRuns.size >= EMBEDDED_DATA.runs.length) {
        doneBtn.classList.add("ready");
      }

      // Scroll main content to top
      document.querySelector(".main").scrollTop = 0;
    }

    // ---- Render outputs ----
    function renderOutputs(run) {
      const container = document.getElementById("outputs-body");
      container.innerHTML = "";

      const outputs = run.outputs || [];
      if (outputs.length === 0) {
        container.innerHTML = '<div class="empty-state">No output files</div>';
        return;
      }

      for (const file of outputs) {
        const fileDiv = document.createElement("div");
        fileDiv.className = "output-file";

        // Always show file header with download link
        const header = document.createElement("div");
        header.className = "output-file-header";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = file.name;
        header.appendChild(nameSpan);
        const dlBtn = document.createElement("a");
        dlBtn.className = "dl-btn";
        dlBtn.textContent = "Download";
        dlBtn.download = file.name;
        dlBtn.href = getDownloadUri(file);
        header.appendChild(dlBtn);
        fileDiv.appendChild(header);

        const content = document.createElement("div");
        content.className = "output-file-content";

        if (file.type === "text") {
          const pre = document.createElement("pre");
          pre.textContent = file.content;
          content.appendChild(pre);
        } else if (file.type === "image") {
          const img = document.createElement("img");
          img.src = file.data_uri;
          img.alt = file.name;
          content.appendChild(img);
        } else if (file.type === "pdf") {
          const iframe = document.createElement("iframe");
          iframe.src = file.data_uri;
          content.appendChild(iframe);
        } else if (file.type === "xlsx") {
          renderXlsx(content, file.data_b64);
        } else if (file.type === "binary") {
          const a = document.createElement("a");
          a.className = "download-link";
          a.href = file.data_uri;
          a.download = file.name;
          a.textContent = "Download " + file.name;
          content.appendChild(a);
        } else if (file.type === "error") {
          const pre = document.createElement("pre");
          pre.textContent = file.content;
          pre.style.color = "var(--red)";
          content.appendChild(pre);
        }

        fileDiv.appendChild(content);
        container.appendChild(fileDiv);
      }
    }

    // ---- XLSX rendering via SheetJS ----
    function renderXlsx(container, b64Data) {
      try {
        const raw = Uint8Array.from(atob(b64Data), c => c.charCodeAt(0));
        const wb = XLSX.read(raw, { type: "array" });

        for (let i = 0; i < wb.SheetNames.length; i++) {
          const sheetName = wb.SheetNames[i];
          const ws = wb.Sheets[sheetName];

          if (wb.SheetNames.length > 1) {
            const sheetLabel = document.createElement("div");
            sheetLabel.style.cssText =
              "font-weight:600; font-size:0.8rem; color:#b0aea5; margin-top:0.5rem; margin-bottom:0.25rem;";
            sheetLabel.textContent = "Sheet: " + sheetName;
            container.appendChild(sheetLabel);
          }

          const htmlStr = XLSX.utils.sheet_to_html(ws, { editable: false });
          const wrapper = document.createElement("div");
          wrapper.innerHTML = htmlStr;
          container.appendChild(wrapper);
        }
      } catch (err) {
        container.textContent = "Error rendering spreadsheet: " + err.message;
      }
    }

    // ---- Grades ----
    function renderGrades(run) {
      const section = document.getElementById("grades-section");
      const content = document.getElementById("grades-content");

      if (!run.grading) {
        section.style.display = "none";
        return;
      }

      const grading = run.grading;
      section.style.display = "block";
      // Reset to collapsed
      content.classList.remove("open");
      document.getElementById("grades-arrow").classList.remove("open");

      const summary = grading.summary || {};
      const expectations = grading.expectations || [];

      let html = '<div style="padding: 1rem;">';

      // Summary line
      const passRate = summary.pass_rate != null
        ? Math.round(summary.pass_rate * 100) + "%"
        : "?";
      const badgeClass = summary.pass_rate >= 0.8 ? "grade-pass" : summary.pass_rate >= 0.5 ? "" : "grade-fail";
      html += '<div class="grades-summary">';
      html += '<span class="grade-badge ' + badgeClass + '">' + passRate + '</span>';
      html += '<span>' + (summary.passed || 0) + ' passed, ' + (summary.failed || 0) + ' failed of ' + (summary.total || 0) + '</span>';
      html += '</div>';

      // Assertions list
      html += '<ul class="assertion-list">';
      for (const exp of expectations) {
        const statusClass = exp.passed ? "pass" : "fail";
        const statusIcon = exp.passed ? "\\u2713" : "\\u2717";
        html += '<li class="assertion-item">';
        html += '<span class="assertion-status ' + statusClass + '">' + statusIcon + '</span>';
        html += '<span>' + escapeHtml(exp.text) + '</span>';
        if (exp.evidence) {
          html += '<div class="assertion-evidence">' + escapeHtml(exp.evidence) + '</div>';
        }
        html += '</li>';
      }
      html += '</ul>';

      html += '</div>';
      content.innerHTML = html;
    }

    function toggleGrades() {
      const content = document.getElementById("grades-content");
      const arrow = document.getElementById("grades-arrow");
      content.classList.toggle("open");
      arrow.classList.toggle("open");
    }

    // ---- Previous outputs (collapsible) ----
    function renderPrevOutputs(run) {
      const section = document.getElementById("prev-outputs-section");
      const content = document.getElementById("prev-outputs-content");
      const prevOutputs = (EMBEDDED_DATA.previous_outputs || {})[run.id];

      if (!prevOutputs || prevOutputs.length === 0) {
        section.style.display = "none";
        return;
      }

      section.style.display = "block";
      // Reset to collapsed
      content.classList.remove("open");
      document.getElementById("prev-outputs-arrow").classList.remove("open");

      // Render the files into the content area
      content.innerHTML = "";
      const wrapper = document.createElement("div");
      wrapper.style.padding = "1rem";

      for (const file of prevOutputs) {
        const fileDiv = document.createElement("div");
        fileDiv.className = "output-file";

        const header = document.createElement("div");
        header.className = "output-file-header";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = file.name;
        header.appendChild(nameSpan);
        const dlBtn = document.createElement("a");
        dlBtn.className = "dl-btn";
        dlBtn.textContent = "Download";
        dlBtn.download = file.name;
        dlBtn.href = getDownloadUri(file);
        header.appendChild(dlBtn);
        fileDiv.appendChild(header);

        const fc = document.createElement("div");
        fc.className = "output-file-content";

        if (file.type === "text") {
          const pre = document.createElement("pre");
          pre.textContent = file.content;
          fc.appendChild(pre);
        } else if (file.type === "image") {
          const img = document.createElement("img");
          img.src = file.data_uri;
          img.alt = file.name;
          fc.appendChild(img);
        } else if (file.type === "pdf") {
          const iframe = document.createElement("iframe");
          iframe.src = file.data_uri;
          fc.appendChild(iframe);
        } else if (file.type === "xlsx") {
          renderXlsx(fc, file.data_b64);
        } else if (file.type === "binary") {
          const a = document.createElement("a");
          a.className = "download-link";
          a.href = file.data_uri;
          a.download = file.name;
          a.textContent = "Download " + file.name;
          fc.appendChild(a);
        }

        fileDiv.appendChild(fc);
        wrapper.appendChild(fileDiv);
      }

      content.appendChild(wrapper);
    }

    function togglePrevOutputs() {
      const content = document.getElementById("prev-outputs-content");
      const arrow = document.getElementById("prev-outputs-arrow");
      content.classList.toggle("open");
      arrow.classList.toggle("open");
    }

    // ---- Feedback (saved to server -> feedback.json) ----
    function saveCurrentFeedback() {
      const run = EMBEDDED_DATA.runs[currentIndex];
      const text = document.getElementById("feedback").value;

      if (text.trim() === "") {
        delete feedbackMap[run.id];
      } else {
        feedbackMap[run.id] = text;
      }

      // Build reviews array from map
      const reviews = [];
      for (const [run_id, feedback] of Object.entries(feedbackMap)) {
        if (feedback.trim()) {
          reviews.push({ run_id, feedback, timestamp: new Date().toISOString() });
        }
      }

      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews, status: "in_progress" }),
      }).then(() => {
        document.getElementById("feedback-status").textContent = "Saved";
      }).catch(() => {
        // Static mode or server unavailable — no-op on auto-save,
        // feedback will be downloaded on final submit
        document.getElementById("feedback-status").textContent = "Will download on submit";
      });
    }

    // ---- Done ----
    function showDoneDialog() {
      // Save current textarea to feedbackMap (but don't POST yet)
      const run = EMBEDDED_DATA.runs[currentIndex];
      const text = document.getElementById("feedback").value;
      if (text.trim() === "") {
        delete feedbackMap[run.id];
      } else {
        feedbackMap[run.id] = text;
      }

      // POST once with status: complete — include ALL runs so the model
      // can distinguish "no feedback" (looks good) from "not reviewed"
      const reviews = [];
      const ts = new Date().toISOString();
      for (const r of EMBEDDED_DATA.runs) {
        reviews.push({ run_id: r.id, feedback: feedbackMap[r.id] || "", timestamp: ts });
      }
      const payload = JSON.stringify({ reviews, status: "complete" }, null, 2);
      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      }).then(() => {
        document.getElementById("done-overlay").classList.add("visible");
      }).catch(() => {
        // Server not available (static mode) — download as file
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "feedback.json";
        a.click();
        URL.revokeObjectURL(url);
        document.getElementById("done-overlay").classList.add("visible");
      });
    }

    function closeDoneDialog() {
      // Reset status back to in_progress
      saveCurrentFeedback();
      document.getElementById("done-overlay").classList.remove("visible");
    }

    // ---- Toast ----
    function showToast(message) {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.classList.add("visible");
      setTimeout(() => toast.classList.remove("visible"), 2000);
    }

    // ---- Keyboard nav ----
    document.addEventListener("keydown", (e) => {
      // Don't capture when typing in textarea
      if (e.target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        navigate(-1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        navigate(1);
      }
    });

    // ---- Util ----
    function getDownloadUri(file) {
      if (file.data_uri) return file.data_uri;
      if (file.data_b64) return "data:application/octet-stream;base64," + file.data_b64;
      if (file.type === "text") return "data:text/plain;charset=utf-8," + encodeURIComponent(file.content);
      return "#";
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    // ---- View switching ----
    function switchView(view) {
      document.querySelectorAll(".view-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".view-panel").forEach(p => p.classList.remove("active"));
      document.querySelector(\`[onclick="switchView('\${view}')"]\`).classList.add("active");
      document.getElementById("panel-" + view).classList.add("active");
    }

    // ---- Benchmark rendering ----
    function renderBenchmark() {
      const data = EMBEDDED_DATA.benchmark;
      if (!data) return;

      // Show the tabs
      document.getElementById("view-tabs").style.display = "flex";

      const container = document.getElementById("benchmark-content");
      const summary = data.run_summary || {};
      const metadata = data.metadata || {};
      const notes = data.notes || [];

      let html = "";

      // Header
      html += "<h2 style='font-family: Poppins, sans-serif; margin-bottom: 0.5rem;'>Benchmark Results</h2>";
      html += "<p style='color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.25rem;'>";
      if (metadata.skill_name) html += "<strong>" + escapeHtml(metadata.skill_name) + "</strong> &mdash; ";
      if (metadata.timestamp) html += metadata.timestamp + " &mdash; ";
      if (metadata.evals_run) html += "Evals: " + metadata.evals_run.join(", ") + " &mdash; ";
      html += (metadata.runs_per_configuration || "?") + " runs per configuration";
      html += "</p>";

      // Summary table
      html += '<table class="benchmark-table">';

      function fmtStat(stat, pct) {
        if (!stat) return "—";
        const suffix = pct ? "%" : "";
        const m = pct ? (stat.mean * 100).toFixed(0) : stat.mean.toFixed(1);
        const s = pct ? (stat.stddev * 100).toFixed(0) : stat.stddev.toFixed(1);
        return m + suffix + " ± " + s + suffix;
      }

      function deltaClass(val) {
        if (!val) return "";
        const n = parseFloat(val);
        if (n > 0) return "benchmark-delta-positive";
        if (n < 0) return "benchmark-delta-negative";
        return "";
      }

      // Discover config names dynamically (everything except "delta")
      const configs = Object.keys(summary).filter(k => k !== "delta");
      const configA = configs[0] || "config_a";
      const configB = configs[1] || "config_b";
      const labelA = configA.replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase());
      const labelB = configB.replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase());
      const a = summary[configA] || {};
      const b = summary[configB] || {};
      const delta = summary.delta || {};

      html += "<thead><tr><th>Metric</th><th>" + escapeHtml(labelA) + "</th><th>" + escapeHtml(labelB) + "</th><th>Delta</th></tr></thead>";
      html += "<tbody>";

      html += "<tr><td><strong>Pass Rate</strong></td>";
      html += "<td>" + fmtStat(a.pass_rate, true) + "</td>";
      html += "<td>" + fmtStat(b.pass_rate, true) + "</td>";
      html += '<td class="' + deltaClass(delta.pass_rate) + '">' + (delta.pass_rate || "—") + "</td></tr>";

      // Time (only show row if data exists)
      if (a.time_seconds || b.time_seconds) {
        html += "<tr><td><strong>Time (s)</strong></td>";
        html += "<td>" + fmtStat(a.time_seconds, false) + "</td>";
        html += "<td>" + fmtStat(b.time_seconds, false) + "</td>";
        html += '<td class="' + deltaClass(delta.time_seconds) + '">' + (delta.time_seconds ? delta.time_seconds + "s" : "—") + "</td></tr>";
      }

      // Tokens (only show row if data exists)
      if (a.tokens || b.tokens) {
        html += "<tr><td><strong>Tokens</strong></td>";
        html += "<td>" + fmtStat(a.tokens, false) + "</td>";
        html += "<td>" + fmtStat(b.tokens, false) + "</td>";
        html += '<td class="' + deltaClass(delta.tokens) + '">' + (delta.tokens || "—") + "</td></tr>";
      }

      html += "</tbody></table>";

      // Per-eval breakdown (if runs data available)
      const runs = data.runs || [];
      if (runs.length > 0) {
        const evalIds = [...new Set(runs.map(r => r.eval_id))].sort((a, b) => a - b);

        html += "<h3 style='font-family: Poppins, sans-serif; margin-bottom: 0.75rem;'>Per-Eval Breakdown</h3>";

        const hasTime = runs.some(r => r.result && r.result.time_seconds != null);
        const hasErrors = runs.some(r => r.result && r.result.errors > 0);

        for (const evalId of evalIds) {
          const evalRuns = runs.filter(r => r.eval_id === evalId);
          const evalName = evalRuns[0] && evalRuns[0].eval_name ? evalRuns[0].eval_name : "Eval " + evalId;

          html += "<h4 style='font-family: Poppins, sans-serif; margin: 1rem 0 0.5rem; color: var(--text);'>" + escapeHtml(evalName) + "</h4>";
          html += '<table class="benchmark-table">';
          html += "<thead><tr><th>Config</th><th>Run</th><th>Pass Rate</th>";
          if (hasTime) html += "<th>Time (s)</th>";
          if (hasErrors) html += "<th>Crashes During Execution</th>";
          html += "</tr></thead>";
          html += "<tbody>";

          // Group by config and render with average rows
          const configGroups = [...new Set(evalRuns.map(r => r.configuration))];
          for (let ci = 0; ci < configGroups.length; ci++) {
            const config = configGroups[ci];
            const configRuns = evalRuns.filter(r => r.configuration === config);
            if (configRuns.length === 0) continue;

            const rowClass = ci === 0 ? "benchmark-row-with" : "benchmark-row-without";
            const configLabel = config.replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase());

            for (const run of configRuns) {
              const r = run.result || {};
              const prClass = r.pass_rate >= 0.8 ? "benchmark-delta-positive" : r.pass_rate < 0.5 ? "benchmark-delta-negative" : "";
              html += '<tr class="' + rowClass + '">';
              html += "<td>" + configLabel + "</td>";
              html += "<td>" + run.run_number + "</td>";
              html += '<td class="' + prClass + '">' + ((r.pass_rate || 0) * 100).toFixed(0) + "% (" + (r.passed || 0) + "/" + (r.total || 0) + ")</td>";
              if (hasTime) html += "<td>" + (r.time_seconds != null ? r.time_seconds.toFixed(1) : "—") + "</td>";
              if (hasErrors) html += "<td>" + (r.errors || 0) + "</td>";
              html += "</tr>";
            }

            // Average row
            const rates = configRuns.map(r => (r.result || {}).pass_rate || 0);
            const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
            const avgPrClass = avgRate >= 0.8 ? "benchmark-delta-positive" : avgRate < 0.5 ? "benchmark-delta-negative" : "";
            html += '<tr class="benchmark-row-avg ' + rowClass + '">';
            html += "<td>" + configLabel + "</td>";
            html += "<td>Avg</td>";
            html += '<td class="' + avgPrClass + '">' + (avgRate * 100).toFixed(0) + "%</td>";
            if (hasTime) {
              const times = configRuns.map(r => (r.result || {}).time_seconds).filter(t => t != null);
              html += "<td>" + (times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : "—") + "</td>";
            }
            if (hasErrors) html += "<td></td>";
            html += "</tr>";
          }
          html += "</tbody></table>";

          // Per-assertion detail for this eval
          const runsWithExpectations = {};
          for (const config of configGroups) {
            runsWithExpectations[config] = evalRuns.filter(r => r.configuration === config && r.expectations && r.expectations.length > 0);
          }
          const hasAnyExpectations = Object.values(runsWithExpectations).some(runs => runs.length > 0);
          if (hasAnyExpectations) {
            // Collect all unique assertion texts across all configs
            const allAssertions = [];
            const seen = new Set();
            for (const config of configGroups) {
              for (const run of runsWithExpectations[config]) {
                for (const exp of (run.expectations || [])) {
                  if (!seen.has(exp.text)) {
                    seen.add(exp.text);
                    allAssertions.push(exp.text);
                  }
                }
              }
            }

            html += '<table class="benchmark-table" style="margin-top: 0.5rem;">';
            html += "<thead><tr><th>Assertion</th>";
            for (const config of configGroups) {
              const label = config.replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase());
              html += "<th>" + escapeHtml(label) + "</th>";
            }
            html += "</tr></thead><tbody>";

            for (const assertionText of allAssertions) {
              html += "<tr><td>" + escapeHtml(assertionText) + "</td>";

              for (const config of configGroups) {
                html += "<td>";
                for (const run of runsWithExpectations[config]) {
                  const exp = (run.expectations || []).find(e => e.text === assertionText);
                  if (exp) {
                    const cls = exp.passed ? "benchmark-delta-positive" : "benchmark-delta-negative";
                    const icon = exp.passed ? "\\u2713" : "\\u2717";
                    html += '<span class="' + cls + '" title="Run ' + run.run_number + ': ' + escapeHtml(exp.evidence || "") + '">' + icon + "</span> ";
                  } else {
                    html += "— ";
                  }
                }
                html += "</td>";
              }
              html += "</tr>";
            }
            html += "</tbody></table>";
          }
        }
      }

      // Notes
      if (notes.length > 0) {
        html += '<div class="benchmark-notes">';
        html += "<h3>Analysis Notes</h3>";
        html += "<ul>";
        for (const note of notes) {
          html += "<li>" + escapeHtml(note) + "</li>";
        }
        html += "</ul></div>";
      }

      container.innerHTML = html;
    }

    // ---- Start ----
    init();
    renderBenchmark();
  </script>
</body>
</html>
`

export const GENERATE_REVIEW_PY = `#!/usr/bin/env python3
"""Generate and serve a review page for eval results.

Reads the workspace directory, discovers runs (directories with outputs/),
embeds all output data into a self-contained HTML page, and serves it via
a tiny HTTP server. Feedback auto-saves to feedback.json in the workspace.

Usage:
    python generate_review.py <workspace-path> [--port PORT] [--skill-name NAME]
    python generate_review.py <workspace-path> --previous-feedback /path/to/old/feedback.json

No dependencies beyond the Python stdlib are required.
"""

import argparse
import base64
import json
import mimetypes
import os
import re
import signal
import subprocess
import sys
import time
import webbrowser
from functools import partial
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# Files to exclude from output listings
METADATA_FILES = {"transcript.md", "user_notes.md", "metrics.json"}

# Extensions we render as inline text
TEXT_EXTENSIONS = {
    ".txt", ".md", ".json", ".csv", ".py", ".js", ".ts", ".tsx", ".jsx",
    ".yaml", ".yml", ".xml", ".html", ".css", ".sh", ".rb", ".go", ".rs",
    ".java", ".c", ".cpp", ".h", ".hpp", ".sql", ".r", ".toml",
}

# Extensions we render as inline images
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}

# MIME type overrides for common types
MIME_OVERRIDES = {
    ".svg": "image/svg+xml",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def get_mime_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in MIME_OVERRIDES:
        return MIME_OVERRIDES[ext]
    mime, _ = mimetypes.guess_type(str(path))
    return mime or "application/octet-stream"


def find_runs(workspace: Path) -> list[dict]:
    """Recursively find directories that contain an outputs/ subdirectory."""
    runs: list[dict] = []
    _find_runs_recursive(workspace, workspace, runs)
    runs.sort(key=lambda r: (r.get("eval_id", float("inf")), r["id"]))
    return runs


def _find_runs_recursive(root: Path, current: Path, runs: list[dict]) -> None:
    if not current.is_dir():
        return

    outputs_dir = current / "outputs"
    if outputs_dir.is_dir():
        run = build_run(root, current)
        if run:
            runs.append(run)
        return

    skip = {"node_modules", ".git", "__pycache__", "skill", "inputs"}
    for child in sorted(current.iterdir()):
        if child.is_dir() and child.name not in skip:
            _find_runs_recursive(root, child, runs)


def build_run(root: Path, run_dir: Path) -> dict | None:
    """Build a run dict with prompt, outputs, and grading data."""
    prompt = ""
    eval_id = None

    # Try eval_metadata.json
    for candidate in [run_dir / "eval_metadata.json", run_dir.parent / "eval_metadata.json"]:
        if candidate.exists():
            try:
                metadata = json.loads(candidate.read_text())
                prompt = metadata.get("prompt", "")
                eval_id = metadata.get("eval_id")
            except (json.JSONDecodeError, OSError):
                pass
            if prompt:
                break

    # Fall back to transcript.md
    if not prompt:
        for candidate in [run_dir / "transcript.md", run_dir / "outputs" / "transcript.md"]:
            if candidate.exists():
                try:
                    text = candidate.read_text()
                    match = re.search(r"## Eval Prompt\\n\\n([\\s\\S]*?)(?=\\n##|$)", text)
                    if match:
                        prompt = match.group(1).strip()
                except OSError:
                    pass
                if prompt:
                    break

    if not prompt:
        prompt = "(No prompt found)"

    run_id = str(run_dir.relative_to(root)).replace("/", "-").replace("\\\\", "-")

    # Collect output files
    outputs_dir = run_dir / "outputs"
    output_files: list[dict] = []
    if outputs_dir.is_dir():
        for f in sorted(outputs_dir.iterdir()):
            if f.is_file() and f.name not in METADATA_FILES:
                output_files.append(embed_file(f))

    # Load grading if present
    grading = None
    for candidate in [run_dir / "grading.json", run_dir.parent / "grading.json"]:
        if candidate.exists():
            try:
                grading = json.loads(candidate.read_text())
            except (json.JSONDecodeError, OSError):
                pass
            if grading:
                break

    return {
        "id": run_id,
        "prompt": prompt,
        "eval_id": eval_id,
        "outputs": output_files,
        "grading": grading,
    }


def embed_file(path: Path) -> dict:
    """Read a file and return an embedded representation."""
    ext = path.suffix.lower()
    mime = get_mime_type(path)

    if ext in TEXT_EXTENSIONS:
        try:
            content = path.read_text(errors="replace")
        except OSError:
            content = "(Error reading file)"
        return {
            "name": path.name,
            "type": "text",
            "content": content,
        }
    elif ext in IMAGE_EXTENSIONS:
        try:
            raw = path.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
        except OSError:
            return {"name": path.name, "type": "error", "content": "(Error reading file)"}
        return {
            "name": path.name,
            "type": "image",
            "mime": mime,
            "data_uri": f"data:{mime};base64,{b64}",
        }
    elif ext == ".pdf":
        try:
            raw = path.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
        except OSError:
            return {"name": path.name, "type": "error", "content": "(Error reading file)"}
        return {
            "name": path.name,
            "type": "pdf",
            "data_uri": f"data:{mime};base64,{b64}",
        }
    elif ext == ".xlsx":
        try:
            raw = path.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
        except OSError:
            return {"name": path.name, "type": "error", "content": "(Error reading file)"}
        return {
            "name": path.name,
            "type": "xlsx",
            "data_b64": b64,
        }
    else:
        # Binary / unknown — base64 download link
        try:
            raw = path.read_bytes()
            b64 = base64.b64encode(raw).decode("ascii")
        except OSError:
            return {"name": path.name, "type": "error", "content": "(Error reading file)"}
        return {
            "name": path.name,
            "type": "binary",
            "mime": mime,
            "data_uri": f"data:{mime};base64,{b64}",
        }


def load_previous_iteration(workspace: Path) -> dict[str, dict]:
    """Load previous iteration's feedback and outputs.

    Returns a map of run_id -> {"feedback": str, "outputs": list[dict]}.
    """
    result: dict[str, dict] = {}

    # Load feedback
    feedback_map: dict[str, str] = {}
    feedback_path = workspace / "feedback.json"
    if feedback_path.exists():
        try:
            data = json.loads(feedback_path.read_text())
            feedback_map = {
                r["run_id"]: r["feedback"]
                for r in data.get("reviews", [])
                if r.get("feedback", "").strip()
            }
        except (json.JSONDecodeError, OSError, KeyError):
            pass

    # Load runs (to get outputs)
    prev_runs = find_runs(workspace)
    for run in prev_runs:
        result[run["id"]] = {
            "feedback": feedback_map.get(run["id"], ""),
            "outputs": run.get("outputs", []),
        }

    # Also add feedback for run_ids that had feedback but no matching run
    for run_id, fb in feedback_map.items():
        if run_id not in result:
            result[run_id] = {"feedback": fb, "outputs": []}

    return result


def generate_html(
    runs: list[dict],
    skill_name: str,
    previous: dict[str, dict] | None = None,
    benchmark: dict | None = None,
) -> str:
    """Generate the complete standalone HTML page with embedded data."""
    template_path = Path(__file__).parent / "viewer.html"
    template = template_path.read_text()

    # Build previous_feedback and previous_outputs maps for the template
    previous_feedback: dict[str, str] = {}
    previous_outputs: dict[str, list[dict]] = {}
    if previous:
        for run_id, data in previous.items():
            if data.get("feedback"):
                previous_feedback[run_id] = data["feedback"]
            if data.get("outputs"):
                previous_outputs[run_id] = data["outputs"]

    embedded = {
        "skill_name": skill_name,
        "runs": runs,
        "previous_feedback": previous_feedback,
        "previous_outputs": previous_outputs,
    }
    if benchmark:
        embedded["benchmark"] = benchmark

    data_json = json.dumps(embedded)

    return template.replace("/*__EMBEDDED_DATA__*/", f"const EMBEDDED_DATA = {data_json};")


# ---------------------------------------------------------------------------
# HTTP server (stdlib only, zero dependencies)
# ---------------------------------------------------------------------------

def _kill_port(port: int) -> None:
    """Kill any process listening on the given port."""
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True, text=True, timeout=5,
        )
        for pid_str in result.stdout.strip().split("\\n"):
            if pid_str.strip():
                try:
                    os.kill(int(pid_str.strip()), signal.SIGTERM)
                except (ProcessLookupError, ValueError):
                    pass
        if result.stdout.strip():
            time.sleep(0.5)
    except subprocess.TimeoutExpired:
        pass
    except FileNotFoundError:
        print("Note: lsof not found, cannot check if port is in use", file=sys.stderr)

class ReviewHandler(BaseHTTPRequestHandler):
    """Serves the review HTML and handles feedback saves.

    Regenerates the HTML on each page load so that refreshing the browser
    picks up new eval outputs without restarting the server.
    """

    def __init__(
        self,
        workspace: Path,
        skill_name: str,
        feedback_path: Path,
        previous: dict[str, dict],
        benchmark_path: Path | None,
        *args,
        **kwargs,
    ):
        self.workspace = workspace
        self.skill_name = skill_name
        self.feedback_path = feedback_path
        self.previous = previous
        self.benchmark_path = benchmark_path
        super().__init__(*args, **kwargs)

    def do_GET(self) -> None:
        if self.path == "/" or self.path == "/index.html":
            # Regenerate HTML on each request (re-scans workspace for new outputs)
            runs = find_runs(self.workspace)
            benchmark = None
            if self.benchmark_path and self.benchmark_path.exists():
                try:
                    benchmark = json.loads(self.benchmark_path.read_text())
                except (json.JSONDecodeError, OSError):
                    pass
            html = generate_html(runs, self.skill_name, self.previous, benchmark)
            content = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        elif self.path == "/api/feedback":
            data = b"{}"
            if self.feedback_path.exists():
                data = self.feedback_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_error(404)

    def do_POST(self) -> None:
        if self.path == "/api/feedback":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                if not isinstance(data, dict) or "reviews" not in data:
                    raise ValueError("Expected JSON object with 'reviews' key")
                self.feedback_path.write_text(json.dumps(data, indent=2) + "\\n")
                resp = b'{"ok":true}'
                self.send_response(200)
            except (json.JSONDecodeError, OSError, ValueError) as e:
                resp = json.dumps({"error": str(e)}).encode()
                self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
        else:
            self.send_error(404)

    def log_message(self, format: str, *args: object) -> None:
        # Suppress request logging to keep terminal clean
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and serve eval review")
    parser.add_argument("workspace", type=Path, help="Path to workspace directory")
    parser.add_argument("--port", "-p", type=int, default=3117, help="Server port (default: 3117)")
    parser.add_argument("--skill-name", "-n", type=str, default=None, help="Skill name for header")
    parser.add_argument(
        "--previous-workspace", type=Path, default=None,
        help="Path to previous iteration's workspace (shows old outputs and feedback as context)",
    )
    parser.add_argument(
        "--benchmark", type=Path, default=None,
        help="Path to benchmark.json to show in the Benchmark tab",
    )
    parser.add_argument(
        "--static", "-s", type=Path, default=None,
        help="Write standalone HTML to this path instead of starting a server",
    )
    args = parser.parse_args()

    workspace = args.workspace.resolve()
    if not workspace.is_dir():
        print(f"Error: {workspace} is not a directory", file=sys.stderr)
        sys.exit(1)

    runs = find_runs(workspace)
    if not runs:
        print(f"No runs found in {workspace}", file=sys.stderr)
        sys.exit(1)

    skill_name = args.skill_name or workspace.name.replace("-workspace", "")
    feedback_path = workspace / "feedback.json"

    previous: dict[str, dict] = {}
    if args.previous_workspace:
        previous = load_previous_iteration(args.previous_workspace.resolve())

    benchmark_path = args.benchmark.resolve() if args.benchmark else None
    benchmark = None
    if benchmark_path and benchmark_path.exists():
        try:
            benchmark = json.loads(benchmark_path.read_text())
        except (json.JSONDecodeError, OSError):
            pass

    if args.static:
        html = generate_html(runs, skill_name, previous, benchmark)
        args.static.parent.mkdir(parents=True, exist_ok=True)
        args.static.write_text(html)
        print(f"\\n  Static viewer written to: {args.static}\\n")
        sys.exit(0)

    # Kill any existing process on the target port
    port = args.port
    _kill_port(port)
    handler = partial(ReviewHandler, workspace, skill_name, feedback_path, previous, benchmark_path)
    try:
        server = HTTPServer(("127.0.0.1", port), handler)
    except OSError:
        # Port still in use after kill attempt — find a free one
        server = HTTPServer(("127.0.0.1", 0), handler)
        port = server.server_address[1]

    url = f"http://localhost:{port}"
    print(f"\\n  Eval Viewer")
    print(f"  ─────────────────────────────────")
    print(f"  URL:       {url}")
    print(f"  Workspace: {workspace}")
    print(f"  Feedback:  {feedback_path}")
    if previous:
        print(f"  Previous:  {args.previous_workspace} ({len(previous)} runs)")
    if benchmark_path:
        print(f"  Benchmark: {benchmark_path}")
    print(f"\\n  Press Ctrl+C to stop.\\n")

    webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()
`

export const RUN_EVAL_PY = `#!/usr/bin/env python3
"""Run trigger evaluation for a skill description.

Tests whether a skill's description causes Claude to trigger (read the skill)
for a set of queries. Outputs results as JSON.
"""

import argparse
import json
import os
import select
import subprocess
import sys
import time
import uuid
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from scripts.utils import parse_skill_md


def find_project_root() -> Path:
    """Find the project root by walking up from cwd looking for .claude/.

    Mimics how Claude Code discovers its project root, so the command file
    we create ends up where claude -p will look for it.
    """
    current = Path.cwd()
    for parent in [current, *current.parents]:
        if (parent / ".claude").is_dir():
            return parent
    return current


def run_single_query(
    query: str,
    skill_name: str,
    skill_description: str,
    timeout: int,
    project_root: str,
    model: str | None = None,
) -> bool:
    """Run a single query and return whether the skill was triggered.

    Creates a command file in .claude/commands/ so it appears in Claude's
    available_skills list, then runs \`claude -p\` with the raw query.
    Uses --include-partial-messages to detect triggering early from
    stream events (content_block_start) rather than waiting for the
    full assistant message, which only arrives after tool execution.
    """
    unique_id = uuid.uuid4().hex[:8]
    clean_name = f"{skill_name}-skill-{unique_id}"
    project_commands_dir = Path(project_root) / ".claude" / "commands"
    command_file = project_commands_dir / f"{clean_name}.md"

    try:
        project_commands_dir.mkdir(parents=True, exist_ok=True)
        # Use YAML block scalar to avoid breaking on quotes in description
        indented_desc = "\\n  ".join(skill_description.split("\\n"))
        command_content = (
            f"---\\n"
            f"description: |\\n"
            f"  {indented_desc}\\n"
            f"---\\n\\n"
            f"# {skill_name}\\n\\n"
            f"This skill handles: {skill_description}\\n"
        )
        command_file.write_text(command_content)

        cmd = [
            "claude",
            "-p", query,
            "--output-format", "stream-json",
            "--verbose",
            "--include-partial-messages",
        ]
        if model:
            cmd.extend(["--model", model])

        # Remove CLAUDECODE env var to allow nesting claude -p inside a
        # Claude Code session. The guard is for interactive terminal conflicts;
        # programmatic subprocess usage is safe.
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            cwd=project_root,
            env=env,
        )

        triggered = False
        start_time = time.time()
        buffer = ""
        # Track state for stream event detection
        pending_tool_name = None
        accumulated_json = ""

        try:
            while time.time() - start_time < timeout:
                if process.poll() is not None:
                    remaining = process.stdout.read()
                    if remaining:
                        buffer += remaining.decode("utf-8", errors="replace")
                    break

                ready, _, _ = select.select([process.stdout], [], [], 1.0)
                if not ready:
                    continue

                chunk = os.read(process.stdout.fileno(), 8192)
                if not chunk:
                    break
                buffer += chunk.decode("utf-8", errors="replace")

                while "\\n" in buffer:
                    line, buffer = buffer.split("\\n", 1)
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    # Early detection via stream events
                    if event.get("type") == "stream_event":
                        se = event.get("event", {})
                        se_type = se.get("type", "")

                        if se_type == "content_block_start":
                            cb = se.get("content_block", {})
                            if cb.get("type") == "tool_use":
                                tool_name = cb.get("name", "")
                                if tool_name in ("Skill", "Read"):
                                    pending_tool_name = tool_name
                                    accumulated_json = ""
                                else:
                                    return False

                        elif se_type == "content_block_delta" and pending_tool_name:
                            delta = se.get("delta", {})
                            if delta.get("type") == "input_json_delta":
                                accumulated_json += delta.get("partial_json", "")
                                if clean_name in accumulated_json:
                                    return True

                        elif se_type in ("content_block_stop", "message_stop"):
                            if pending_tool_name:
                                return clean_name in accumulated_json
                            if se_type == "message_stop":
                                return False

                    # Fallback: full assistant message
                    elif event.get("type") == "assistant":
                        message = event.get("message", {})
                        for content_item in message.get("content", []):
                            if content_item.get("type") != "tool_use":
                                continue
                            tool_name = content_item.get("name", "")
                            tool_input = content_item.get("input", {})
                            if tool_name == "Skill" and clean_name in tool_input.get("skill", ""):
                                triggered = True
                            elif tool_name == "Read" and clean_name in tool_input.get("file_path", ""):
                                triggered = True
                            return triggered

                    elif event.get("type") == "result":
                        return triggered
        finally:
            # Clean up process on any exit path (return, exception, timeout)
            if process.poll() is None:
                process.kill()
                process.wait()

        return triggered
    finally:
        if command_file.exists():
            command_file.unlink()


def run_eval(
    eval_set: list[dict],
    skill_name: str,
    description: str,
    num_workers: int,
    timeout: int,
    project_root: Path,
    runs_per_query: int = 1,
    trigger_threshold: float = 0.5,
    model: str | None = None,
) -> dict:
    """Run the full eval set and return results."""
    results = []

    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        future_to_info = {}
        for item in eval_set:
            for run_idx in range(runs_per_query):
                future = executor.submit(
                    run_single_query,
                    item["query"],
                    skill_name,
                    description,
                    timeout,
                    str(project_root),
                    model,
                )
                future_to_info[future] = (item, run_idx)

        query_triggers: dict[str, list[bool]] = {}
        query_items: dict[str, dict] = {}
        for future in as_completed(future_to_info):
            item, _ = future_to_info[future]
            query = item["query"]
            query_items[query] = item
            if query not in query_triggers:
                query_triggers[query] = []
            try:
                query_triggers[query].append(future.result())
            except Exception as e:
                print(f"Warning: query failed: {e}", file=sys.stderr)
                query_triggers[query].append(False)

    for query, triggers in query_triggers.items():
        item = query_items[query]
        trigger_rate = sum(triggers) / len(triggers)
        should_trigger = item["should_trigger"]
        if should_trigger:
            did_pass = trigger_rate >= trigger_threshold
        else:
            did_pass = trigger_rate < trigger_threshold
        results.append({
            "query": query,
            "should_trigger": should_trigger,
            "trigger_rate": trigger_rate,
            "triggers": sum(triggers),
            "runs": len(triggers),
            "pass": did_pass,
        })

    passed = sum(1 for r in results if r["pass"])
    total = len(results)

    return {
        "skill_name": skill_name,
        "description": description,
        "results": results,
        "summary": {
            "total": total,
            "passed": passed,
            "failed": total - passed,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Run trigger evaluation for a skill description")
    parser.add_argument("--eval-set", required=True, help="Path to eval set JSON file")
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument("--description", default=None, help="Override description to test")
    parser.add_argument("--num-workers", type=int, default=10, help="Number of parallel workers")
    parser.add_argument("--timeout", type=int, default=30, help="Timeout per query in seconds")
    parser.add_argument("--runs-per-query", type=int, default=3, help="Number of runs per query")
    parser.add_argument("--trigger-threshold", type=float, default=0.5, help="Trigger rate threshold")
    parser.add_argument("--model", default=None, help="Model to use for claude -p (default: user's configured model)")
    parser.add_argument("--verbose", action="store_true", help="Print progress to stderr")
    args = parser.parse_args()

    eval_set = json.loads(Path(args.eval_set).read_text())
    skill_path = Path(args.skill_path)

    if not (skill_path / "SKILL.md").exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        sys.exit(1)

    name, original_description, content = parse_skill_md(skill_path)
    description = args.description or original_description
    project_root = find_project_root()

    if args.verbose:
        print(f"Evaluating: {description}", file=sys.stderr)

    output = run_eval(
        eval_set=eval_set,
        skill_name=name,
        description=description,
        num_workers=args.num_workers,
        timeout=args.timeout,
        project_root=project_root,
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        model=args.model,
    )

    if args.verbose:
        summary = output["summary"]
        print(f"Results: {summary['passed']}/{summary['total']} passed", file=sys.stderr)
        for r in output["results"]:
            status = "PASS" if r["pass"] else "FAIL"
            rate_str = f"{r['triggers']}/{r['runs']}"
            print(f"  [{status}] rate={rate_str} expected={r['should_trigger']}: {r['query'][:70]}", file=sys.stderr)

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
`

export const RUN_LOOP_PY = `#!/usr/bin/env python3
"""Run the eval + improve loop until all pass or max iterations reached.

Combines run_eval.py and improve_description.py in a loop, tracking history
and returning the best description found. Supports train/test split to prevent
overfitting.
"""

import argparse
import json
import random
import sys
import tempfile
import time
import webbrowser
from pathlib import Path

from scripts.generate_report import generate_html
from scripts.improve_description import improve_description
from scripts.run_eval import find_project_root, run_eval
from scripts.utils import parse_skill_md


def split_eval_set(eval_set: list[dict], holdout: float, seed: int = 42) -> tuple[list[dict], list[dict]]:
    """Split eval set into train and test sets, stratified by should_trigger."""
    random.seed(seed)

    # Separate by should_trigger
    trigger = [e for e in eval_set if e["should_trigger"]]
    no_trigger = [e for e in eval_set if not e["should_trigger"]]

    # Shuffle each group
    random.shuffle(trigger)
    random.shuffle(no_trigger)

    # Calculate split points
    n_trigger_test = max(1, int(len(trigger) * holdout))
    n_no_trigger_test = max(1, int(len(no_trigger) * holdout))

    # Split
    test_set = trigger[:n_trigger_test] + no_trigger[:n_no_trigger_test]
    train_set = trigger[n_trigger_test:] + no_trigger[n_no_trigger_test:]

    return train_set, test_set


def run_loop(
    eval_set: list[dict],
    skill_path: Path,
    description_override: str | None,
    num_workers: int,
    timeout: int,
    max_iterations: int,
    runs_per_query: int,
    trigger_threshold: float,
    holdout: float,
    model: str,
    verbose: bool,
    live_report_path: Path | None = None,
    log_dir: Path | None = None,
) -> dict:
    """Run the eval + improvement loop."""
    project_root = find_project_root()
    name, original_description, content = parse_skill_md(skill_path)
    current_description = description_override or original_description

    # Split into train/test if holdout > 0
    if holdout > 0:
        train_set, test_set = split_eval_set(eval_set, holdout)
        if verbose:
            print(f"Split: {len(train_set)} train, {len(test_set)} test (holdout={holdout})", file=sys.stderr)
    else:
        train_set = eval_set
        test_set = []

    history = []
    exit_reason = "unknown"

    for iteration in range(1, max_iterations + 1):
        if verbose:
            print(f"\\n{'='*60}", file=sys.stderr)
            print(f"Iteration {iteration}/{max_iterations}", file=sys.stderr)
            print(f"Description: {current_description}", file=sys.stderr)
            print(f"{'='*60}", file=sys.stderr)

        # Evaluate train + test together in one batch for parallelism
        all_queries = train_set + test_set
        t0 = time.time()
        all_results = run_eval(
            eval_set=all_queries,
            skill_name=name,
            description=current_description,
            num_workers=num_workers,
            timeout=timeout,
            project_root=project_root,
            runs_per_query=runs_per_query,
            trigger_threshold=trigger_threshold,
            model=model,
        )
        eval_elapsed = time.time() - t0

        # Split results back into train/test by matching queries
        train_queries_set = {q["query"] for q in train_set}
        train_result_list = [r for r in all_results["results"] if r["query"] in train_queries_set]
        test_result_list = [r for r in all_results["results"] if r["query"] not in train_queries_set]

        train_passed = sum(1 for r in train_result_list if r["pass"])
        train_total = len(train_result_list)
        train_summary = {"passed": train_passed, "failed": train_total - train_passed, "total": train_total}
        train_results = {"results": train_result_list, "summary": train_summary}

        if test_set:
            test_passed = sum(1 for r in test_result_list if r["pass"])
            test_total = len(test_result_list)
            test_summary = {"passed": test_passed, "failed": test_total - test_passed, "total": test_total}
            test_results = {"results": test_result_list, "summary": test_summary}
        else:
            test_results = None
            test_summary = None

        history.append({
            "iteration": iteration,
            "description": current_description,
            "train_passed": train_summary["passed"],
            "train_failed": train_summary["failed"],
            "train_total": train_summary["total"],
            "train_results": train_results["results"],
            "test_passed": test_summary["passed"] if test_summary else None,
            "test_failed": test_summary["failed"] if test_summary else None,
            "test_total": test_summary["total"] if test_summary else None,
            "test_results": test_results["results"] if test_results else None,
            # For backward compat with report generator
            "passed": train_summary["passed"],
            "failed": train_summary["failed"],
            "total": train_summary["total"],
            "results": train_results["results"],
        })

        # Write live report if path provided
        if live_report_path:
            partial_output = {
                "original_description": original_description,
                "best_description": current_description,
                "best_score": "in progress",
                "iterations_run": len(history),
                "holdout": holdout,
                "train_size": len(train_set),
                "test_size": len(test_set),
                "history": history,
            }
            live_report_path.write_text(generate_html(partial_output, auto_refresh=True, skill_name=name))

        if verbose:
            def print_eval_stats(label, results, elapsed):
                pos = [r for r in results if r["should_trigger"]]
                neg = [r for r in results if not r["should_trigger"]]
                tp = sum(r["triggers"] for r in pos)
                pos_runs = sum(r["runs"] for r in pos)
                fn = pos_runs - tp
                fp = sum(r["triggers"] for r in neg)
                neg_runs = sum(r["runs"] for r in neg)
                tn = neg_runs - fp
                total = tp + tn + fp + fn
                precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
                recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
                accuracy = (tp + tn) / total if total > 0 else 0.0
                print(f"{label}: {tp+tn}/{total} correct, precision={precision:.0%} recall={recall:.0%} accuracy={accuracy:.0%} ({elapsed:.1f}s)", file=sys.stderr)
                for r in results:
                    status = "PASS" if r["pass"] else "FAIL"
                    rate_str = f"{r['triggers']}/{r['runs']}"
                    print(f"  [{status}] rate={rate_str} expected={r['should_trigger']}: {r['query'][:60]}", file=sys.stderr)

            print_eval_stats("Train", train_results["results"], eval_elapsed)
            if test_summary:
                print_eval_stats("Test ", test_results["results"], 0)

        if train_summary["failed"] == 0:
            exit_reason = f"all_passed (iteration {iteration})"
            if verbose:
                print(f"\\nAll train queries passed on iteration {iteration}!", file=sys.stderr)
            break

        if iteration == max_iterations:
            exit_reason = f"max_iterations ({max_iterations})"
            if verbose:
                print(f"\\nMax iterations reached ({max_iterations}).", file=sys.stderr)
            break

        # Improve the description based on train results
        if verbose:
            print(f"\\nImproving description...", file=sys.stderr)

        t0 = time.time()
        # Strip test scores from history so improvement model can't see them
        blinded_history = [
            {k: v for k, v in h.items() if not k.startswith("test_")}
            for h in history
        ]
        new_description = improve_description(
            skill_name=name,
            skill_content=content,
            current_description=current_description,
            eval_results=train_results,
            history=blinded_history,
            model=model,
            log_dir=log_dir,
            iteration=iteration,
        )
        improve_elapsed = time.time() - t0

        if verbose:
            print(f"Proposed ({improve_elapsed:.1f}s): {new_description}", file=sys.stderr)

        current_description = new_description

    # Find the best iteration by TEST score (or train if no test set)
    if test_set:
        best = max(history, key=lambda h: h["test_passed"] or 0)
        best_score = f"{best['test_passed']}/{best['test_total']}"
    else:
        best = max(history, key=lambda h: h["train_passed"])
        best_score = f"{best['train_passed']}/{best['train_total']}"

    if verbose:
        print(f"\\nExit reason: {exit_reason}", file=sys.stderr)
        print(f"Best score: {best_score} (iteration {best['iteration']})", file=sys.stderr)

    return {
        "exit_reason": exit_reason,
        "original_description": original_description,
        "best_description": best["description"],
        "best_score": best_score,
        "best_train_score": f"{best['train_passed']}/{best['train_total']}",
        "best_test_score": f"{best['test_passed']}/{best['test_total']}" if test_set else None,
        "final_description": current_description,
        "iterations_run": len(history),
        "holdout": holdout,
        "train_size": len(train_set),
        "test_size": len(test_set),
        "history": history,
    }


def main():
    parser = argparse.ArgumentParser(description="Run eval + improve loop")
    parser.add_argument("--eval-set", required=True, help="Path to eval set JSON file")
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument("--description", default=None, help="Override starting description")
    parser.add_argument("--num-workers", type=int, default=10, help="Number of parallel workers")
    parser.add_argument("--timeout", type=int, default=30, help="Timeout per query in seconds")
    parser.add_argument("--max-iterations", type=int, default=5, help="Max improvement iterations")
    parser.add_argument("--runs-per-query", type=int, default=3, help="Number of runs per query")
    parser.add_argument("--trigger-threshold", type=float, default=0.5, help="Trigger rate threshold")
    parser.add_argument("--holdout", type=float, default=0.4, help="Fraction of eval set to hold out for testing (0 to disable)")
    parser.add_argument("--model", required=True, help="Model for improvement")
    parser.add_argument("--verbose", action="store_true", help="Print progress to stderr")
    parser.add_argument("--report", default="auto", help="Generate HTML report at this path (default: 'auto' for temp file, 'none' to disable)")
    parser.add_argument("--results-dir", default=None, help="Save all outputs (results.json, report.html, log.txt) to a timestamped subdirectory here")
    args = parser.parse_args()

    eval_set = json.loads(Path(args.eval_set).read_text())
    skill_path = Path(args.skill_path)

    if not (skill_path / "SKILL.md").exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        sys.exit(1)

    name, _, _ = parse_skill_md(skill_path)

    # Set up live report path
    if args.report != "none":
        if args.report == "auto":
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            live_report_path = Path(tempfile.gettempdir()) / f"skill_description_report_{skill_path.name}_{timestamp}.html"
        else:
            live_report_path = Path(args.report)
        # Open the report immediately so the user can watch
        live_report_path.write_text("<html><body><h1>Starting optimization loop...</h1><meta http-equiv='refresh' content='5'></body></html>")
        webbrowser.open(str(live_report_path))
    else:
        live_report_path = None

    # Determine output directory (create before run_loop so logs can be written)
    if args.results_dir:
        timestamp = time.strftime("%Y-%m-%d_%H%M%S")
        results_dir = Path(args.results_dir) / timestamp
        results_dir.mkdir(parents=True, exist_ok=True)
    else:
        results_dir = None

    log_dir = results_dir / "logs" if results_dir else None

    output = run_loop(
        eval_set=eval_set,
        skill_path=skill_path,
        description_override=args.description,
        num_workers=args.num_workers,
        timeout=args.timeout,
        max_iterations=args.max_iterations,
        runs_per_query=args.runs_per_query,
        trigger_threshold=args.trigger_threshold,
        holdout=args.holdout,
        model=args.model,
        verbose=args.verbose,
        live_report_path=live_report_path,
        log_dir=log_dir,
    )

    # Save JSON output
    json_output = json.dumps(output, indent=2)
    print(json_output)
    if results_dir:
        (results_dir / "results.json").write_text(json_output)

    # Write final HTML report (without auto-refresh)
    if live_report_path:
        live_report_path.write_text(generate_html(output, auto_refresh=False, skill_name=name))
        print(f"\\nReport: {live_report_path}", file=sys.stderr)

    if results_dir and live_report_path:
        (results_dir / "report.html").write_text(generate_html(output, auto_refresh=False, skill_name=name))

    if results_dir:
        print(f"Results saved to: {results_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
`

export const AGGREGATE_BENCHMARK_PY = `#!/usr/bin/env python3
"""
Aggregate individual run results into benchmark summary statistics.

Reads grading.json files from run directories and produces:
- run_summary with mean, stddev, min, max for each metric
- delta between with_skill and without_skill configurations

Usage:
    python aggregate_benchmark.py <benchmark_dir>

Example:
    python aggregate_benchmark.py benchmarks/2026-01-15T10-30-00/

The script supports two directory layouts:

    Workspace layout (from skill-creator iterations):
    <benchmark_dir>/
    └── eval-N/
        ├── with_skill/
        │   ├── run-1/grading.json
        │   └── run-2/grading.json
        └── without_skill/
            ├── run-1/grading.json
            └── run-2/grading.json

    Legacy layout (with runs/ subdirectory):
    <benchmark_dir>/
    └── runs/
        └── eval-N/
            ├── with_skill/
            │   └── run-1/grading.json
            └── without_skill/
                └── run-1/grading.json
"""

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path


def calculate_stats(values: list[float]) -> dict:
    """Calculate mean, stddev, min, max for a list of values."""
    if not values:
        return {"mean": 0.0, "stddev": 0.0, "min": 0.0, "max": 0.0}

    n = len(values)
    mean = sum(values) / n

    if n > 1:
        variance = sum((x - mean) ** 2 for x in values) / (n - 1)
        stddev = math.sqrt(variance)
    else:
        stddev = 0.0

    return {
        "mean": round(mean, 4),
        "stddev": round(stddev, 4),
        "min": round(min(values), 4),
        "max": round(max(values), 4)
    }


def load_run_results(benchmark_dir: Path) -> dict:
    """
    Load all run results from a benchmark directory.

    Returns dict keyed by config name (e.g. "with_skill"/"without_skill",
    or "new_skill"/"old_skill"), each containing a list of run results.
    """
    # Support both layouts: eval dirs directly under benchmark_dir, or under runs/
    runs_dir = benchmark_dir / "runs"
    if runs_dir.exists():
        search_dir = runs_dir
    elif list(benchmark_dir.glob("eval-*")):
        search_dir = benchmark_dir
    else:
        print(f"No eval directories found in {benchmark_dir} or {benchmark_dir / 'runs'}")
        return {}

    results: dict[str, list] = {}

    for eval_idx, eval_dir in enumerate(sorted(search_dir.glob("eval-*"))):
        metadata_path = eval_dir / "eval_metadata.json"
        if metadata_path.exists():
            try:
                with open(metadata_path) as mf:
                    eval_id = json.load(mf).get("eval_id", eval_idx)
            except (json.JSONDecodeError, OSError):
                eval_id = eval_idx
        else:
            try:
                eval_id = int(eval_dir.name.split("-")[1])
            except ValueError:
                eval_id = eval_idx

        # Discover config directories dynamically rather than hardcoding names
        for config_dir in sorted(eval_dir.iterdir()):
            if not config_dir.is_dir():
                continue
            # Skip non-config directories (inputs, outputs, etc.)
            if not list(config_dir.glob("run-*")):
                continue
            config = config_dir.name
            if config not in results:
                results[config] = []

            for run_dir in sorted(config_dir.glob("run-*")):
                run_number = int(run_dir.name.split("-")[1])
                grading_file = run_dir / "grading.json"

                if not grading_file.exists():
                    print(f"Warning: grading.json not found in {run_dir}")
                    continue

                try:
                    with open(grading_file) as f:
                        grading = json.load(f)
                except json.JSONDecodeError as e:
                    print(f"Warning: Invalid JSON in {grading_file}: {e}")
                    continue

                # Extract metrics
                result = {
                    "eval_id": eval_id,
                    "run_number": run_number,
                    "pass_rate": grading.get("summary", {}).get("pass_rate", 0.0),
                    "passed": grading.get("summary", {}).get("passed", 0),
                    "failed": grading.get("summary", {}).get("failed", 0),
                    "total": grading.get("summary", {}).get("total", 0),
                }

                # Extract timing — check grading.json first, then sibling timing.json
                timing = grading.get("timing", {})
                result["time_seconds"] = timing.get("total_duration_seconds", 0.0)
                timing_file = run_dir / "timing.json"
                if result["time_seconds"] == 0.0 and timing_file.exists():
                    try:
                        with open(timing_file) as tf:
                            timing_data = json.load(tf)
                        result["time_seconds"] = timing_data.get("total_duration_seconds", 0.0)
                        result["tokens"] = timing_data.get("total_tokens", 0)
                    except json.JSONDecodeError:
                        pass

                # Extract metrics if available
                metrics = grading.get("execution_metrics", {})
                result["tool_calls"] = metrics.get("total_tool_calls", 0)
                if not result.get("tokens"):
                    result["tokens"] = metrics.get("output_chars", 0)
                result["errors"] = metrics.get("errors_encountered", 0)

                # Extract expectations — viewer requires fields: text, passed, evidence
                raw_expectations = grading.get("expectations", [])
                for exp in raw_expectations:
                    if "text" not in exp or "passed" not in exp:
                        print(f"Warning: expectation in {grading_file} missing required fields (text, passed, evidence): {exp}")
                result["expectations"] = raw_expectations

                # Extract notes from user_notes_summary
                notes_summary = grading.get("user_notes_summary", {})
                notes = []
                notes.extend(notes_summary.get("uncertainties", []))
                notes.extend(notes_summary.get("needs_review", []))
                notes.extend(notes_summary.get("workarounds", []))
                result["notes"] = notes

                results[config].append(result)

    return results


def aggregate_results(results: dict) -> dict:
    """
    Aggregate run results into summary statistics.

    Returns run_summary with stats for each configuration and delta.
    """
    run_summary = {}
    configs = list(results.keys())

    for config in configs:
        runs = results.get(config, [])

        if not runs:
            run_summary[config] = {
                "pass_rate": {"mean": 0.0, "stddev": 0.0, "min": 0.0, "max": 0.0},
                "time_seconds": {"mean": 0.0, "stddev": 0.0, "min": 0.0, "max": 0.0},
                "tokens": {"mean": 0, "stddev": 0, "min": 0, "max": 0}
            }
            continue

        pass_rates = [r["pass_rate"] for r in runs]
        times = [r["time_seconds"] for r in runs]
        tokens = [r.get("tokens", 0) for r in runs]

        run_summary[config] = {
            "pass_rate": calculate_stats(pass_rates),
            "time_seconds": calculate_stats(times),
            "tokens": calculate_stats(tokens)
        }

    # Calculate delta between the first two configs (if two exist)
    if len(configs) >= 2:
        primary = run_summary.get(configs[0], {})
        baseline = run_summary.get(configs[1], {})
    else:
        primary = run_summary.get(configs[0], {}) if configs else {}
        baseline = {}

    delta_pass_rate = primary.get("pass_rate", {}).get("mean", 0) - baseline.get("pass_rate", {}).get("mean", 0)
    delta_time = primary.get("time_seconds", {}).get("mean", 0) - baseline.get("time_seconds", {}).get("mean", 0)
    delta_tokens = primary.get("tokens", {}).get("mean", 0) - baseline.get("tokens", {}).get("mean", 0)

    run_summary["delta"] = {
        "pass_rate": f"{delta_pass_rate:+.2f}",
        "time_seconds": f"{delta_time:+.1f}",
        "tokens": f"{delta_tokens:+.0f}"
    }

    return run_summary


def generate_benchmark(benchmark_dir: Path, skill_name: str = "", skill_path: str = "") -> dict:
    """
    Generate complete benchmark.json from run results.
    """
    results = load_run_results(benchmark_dir)
    run_summary = aggregate_results(results)

    # Build runs array for benchmark.json
    runs = []
    for config in results:
        for result in results[config]:
            runs.append({
                "eval_id": result["eval_id"],
                "configuration": config,
                "run_number": result["run_number"],
                "result": {
                    "pass_rate": result["pass_rate"],
                    "passed": result["passed"],
                    "failed": result["failed"],
                    "total": result["total"],
                    "time_seconds": result["time_seconds"],
                    "tokens": result.get("tokens", 0),
                    "tool_calls": result.get("tool_calls", 0),
                    "errors": result.get("errors", 0)
                },
                "expectations": result["expectations"],
                "notes": result["notes"]
            })

    # Determine eval IDs from results
    eval_ids = sorted(set(
        r["eval_id"]
        for config in results.values()
        for r in config
    ))

    benchmark = {
        "metadata": {
            "skill_name": skill_name or "<skill-name>",
            "skill_path": skill_path or "<path/to/skill>",
            "executor_model": "<model-name>",
            "analyzer_model": "<model-name>",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "evals_run": eval_ids,
            "runs_per_configuration": 3
        },
        "runs": runs,
        "run_summary": run_summary,
        "notes": []  # To be filled by analyzer
    }

    return benchmark


def generate_markdown(benchmark: dict) -> str:
    """Generate human-readable benchmark.md from benchmark data."""
    metadata = benchmark["metadata"]
    run_summary = benchmark["run_summary"]

    # Determine config names (excluding "delta")
    configs = [k for k in run_summary if k != "delta"]
    config_a = configs[0] if len(configs) >= 1 else "config_a"
    config_b = configs[1] if len(configs) >= 2 else "config_b"
    label_a = config_a.replace("_", " ").title()
    label_b = config_b.replace("_", " ").title()

    lines = [
        f"# Skill Benchmark: {metadata['skill_name']}",
        "",
        f"**Model**: {metadata['executor_model']}",
        f"**Date**: {metadata['timestamp']}",
        f"**Evals**: {', '.join(map(str, metadata['evals_run']))} ({metadata['runs_per_configuration']} runs each per configuration)",
        "",
        "## Summary",
        "",
        f"| Metric | {label_a} | {label_b} | Delta |",
        "|--------|------------|---------------|-------|",
    ]

    a_summary = run_summary.get(config_a, {})
    b_summary = run_summary.get(config_b, {})
    delta = run_summary.get("delta", {})

    # Format pass rate
    a_pr = a_summary.get("pass_rate", {})
    b_pr = b_summary.get("pass_rate", {})
    lines.append(f"| Pass Rate | {a_pr.get('mean', 0)*100:.0f}% ± {a_pr.get('stddev', 0)*100:.0f}% | {b_pr.get('mean', 0)*100:.0f}% ± {b_pr.get('stddev', 0)*100:.0f}% | {delta.get('pass_rate', '—')} |")

    # Format time
    a_time = a_summary.get("time_seconds", {})
    b_time = b_summary.get("time_seconds", {})
    lines.append(f"| Time | {a_time.get('mean', 0):.1f}s ± {a_time.get('stddev', 0):.1f}s | {b_time.get('mean', 0):.1f}s ± {b_time.get('stddev', 0):.1f}s | {delta.get('time_seconds', '—')}s |")

    # Format tokens
    a_tokens = a_summary.get("tokens", {})
    b_tokens = b_summary.get("tokens", {})
    lines.append(f"| Tokens | {a_tokens.get('mean', 0):.0f} ± {a_tokens.get('stddev', 0):.0f} | {b_tokens.get('mean', 0):.0f} ± {b_tokens.get('stddev', 0):.0f} | {delta.get('tokens', '—')} |")

    # Notes section
    if benchmark.get("notes"):
        lines.extend([
            "",
            "## Notes",
            ""
        ])
        for note in benchmark["notes"]:
            lines.append(f"- {note}")

    return "\\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Aggregate benchmark run results into summary statistics"
    )
    parser.add_argument(
        "benchmark_dir",
        type=Path,
        help="Path to the benchmark directory"
    )
    parser.add_argument(
        "--skill-name",
        default="",
        help="Name of the skill being benchmarked"
    )
    parser.add_argument(
        "--skill-path",
        default="",
        help="Path to the skill being benchmarked"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        help="Output path for benchmark.json (default: <benchmark_dir>/benchmark.json)"
    )

    args = parser.parse_args()

    if not args.benchmark_dir.exists():
        print(f"Directory not found: {args.benchmark_dir}")
        sys.exit(1)

    # Generate benchmark
    benchmark = generate_benchmark(args.benchmark_dir, args.skill_name, args.skill_path)

    # Determine output paths
    output_json = args.output or (args.benchmark_dir / "benchmark.json")
    output_md = output_json.with_suffix(".md")

    # Write benchmark.json
    with open(output_json, "w") as f:
        json.dump(benchmark, f, indent=2)
    print(f"Generated: {output_json}")

    # Write benchmark.md
    markdown = generate_markdown(benchmark)
    with open(output_md, "w") as f:
        f.write(markdown)
    print(f"Generated: {output_md}")

    # Print summary
    run_summary = benchmark["run_summary"]
    configs = [k for k in run_summary if k != "delta"]
    delta = run_summary.get("delta", {})

    print(f"\\nSummary:")
    for config in configs:
        pr = run_summary[config]["pass_rate"]["mean"]
        label = config.replace("_", " ").title()
        print(f"  {label}: {pr*100:.1f}% pass rate")
    print(f"  Delta:         {delta.get('pass_rate', '—')}")


if __name__ == "__main__":
    main()
`

export const IMPROVE_DESCRIPTION_PY = `#!/usr/bin/env python3
"""Improve a skill description based on eval results.

Takes eval results (from run_eval.py) and generates an improved description
by calling \`claude -p\` as a subprocess (same auth pattern as run_eval.py —
uses the session's Claude Code auth, no separate ANTHROPIC_API_KEY needed).
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from scripts.utils import parse_skill_md


def _call_claude(prompt: str, model: str | None, timeout: int = 300) -> str:
    """Run \`claude -p\` with the prompt on stdin and return the text response.

    Prompt goes over stdin (not argv) because it embeds the full SKILL.md
    body and can easily exceed comfortable argv length.
    """
    cmd = ["claude", "-p", "--output-format", "text"]
    if model:
        cmd.extend(["--model", model])

    # Remove CLAUDECODE env var to allow nesting claude -p inside a
    # Claude Code session. The guard is for interactive terminal conflicts;
    # programmatic subprocess usage is safe. Same pattern as run_eval.py.
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

    result = subprocess.run(
        cmd,
        input=prompt,
        capture_output=True,
        text=True,
        env=env,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"claude -p exited {result.returncode}\\nstderr: {result.stderr}"
        )
    return result.stdout


def improve_description(
    skill_name: str,
    skill_content: str,
    current_description: str,
    eval_results: dict,
    history: list[dict],
    model: str,
    test_results: dict | None = None,
    log_dir: Path | None = None,
    iteration: int | None = None,
) -> str:
    """Call Claude to improve the description based on eval results."""
    failed_triggers = [
        r for r in eval_results["results"]
        if r["should_trigger"] and not r["pass"]
    ]
    false_triggers = [
        r for r in eval_results["results"]
        if not r["should_trigger"] and not r["pass"]
    ]

    # Build scores summary
    train_score = f"{eval_results['summary']['passed']}/{eval_results['summary']['total']}"
    if test_results:
        test_score = f"{test_results['summary']['passed']}/{test_results['summary']['total']}"
        scores_summary = f"Train: {train_score}, Test: {test_score}"
    else:
        scores_summary = f"Train: {train_score}"

    prompt = f"""You are optimizing a skill description for a Claude Code skill called "{skill_name}". A "skill" is sort of like a prompt, but with progressive disclosure -- there's a title and description that Claude sees when deciding whether to use the skill, and then if it does use the skill, it reads the .md file which has lots more details and potentially links to other resources in the skill folder like helper files and scripts and additional documentation or examples.

The description appears in Claude's "available_skills" list. When a user sends a query, Claude decides whether to invoke the skill based solely on the title and on this description. Your goal is to write a description that triggers for relevant queries, and doesn't trigger for irrelevant ones.

Here's the current description:
<current_description>
"{current_description}"
</current_description>

Current scores ({scores_summary}):
<scores_summary>
"""
    if failed_triggers:
        prompt += "FAILED TO TRIGGER (should have triggered but didn't):\\n"
        for r in failed_triggers:
            prompt += f'  - "{r["query"]}" (triggered {r["triggers"]}/{r["runs"]} times)\\n'
        prompt += "\\n"

    if false_triggers:
        prompt += "FALSE TRIGGERS (triggered but shouldn't have):\\n"
        for r in false_triggers:
            prompt += f'  - "{r["query"]}" (triggered {r["triggers"]}/{r["runs"]} times)\\n'
        prompt += "\\n"

    if history:
        prompt += "PREVIOUS ATTEMPTS (do NOT repeat these — try something structurally different):\\n\\n"
        for h in history:
            train_s = f"{h.get('train_passed', h.get('passed', 0))}/{h.get('train_total', h.get('total', 0))}"
            test_s = f"{h.get('test_passed', '?')}/{h.get('test_total', '?')}" if h.get('test_passed') is not None else None
            score_str = f"train={train_s}" + (f", test={test_s}" if test_s else "")
            prompt += f'<attempt {score_str}>\\n'
            prompt += f'Description: "{h["description"]}"\\n'
            if "results" in h:
                prompt += "Train results:\\n"
                for r in h["results"]:
                    status = "PASS" if r["pass"] else "FAIL"
                    prompt += f'  [{status}] "{r["query"][:80]}" (triggered {r["triggers"]}/{r["runs"]})\\n'
            if h.get("note"):
                prompt += f'Note: {h["note"]}\\n'
            prompt += "</attempt>\\n\\n"

    prompt += f"""</scores_summary>

Skill content (for context on what the skill does):
<skill_content>
{skill_content}
</skill_content>

Based on the failures, write a new and improved description that is more likely to trigger correctly. When I say "based on the failures", it's a bit of a tricky line to walk because we don't want to overfit to the specific cases you're seeing. So what I DON'T want you to do is produce an ever-expanding list of specific queries that this skill should or shouldn't trigger for. Instead, try to generalize from the failures to broader categories of user intent and situations where this skill would be useful or not useful. The reason for this is twofold:

1. Avoid overfitting
2. The list might get loooong and it's injected into ALL queries and there might be a lot of skills, so we don't want to blow too much space on any given description.

Concretely, your description should not be more than about 100-200 words, even if that comes at the cost of accuracy. There is a hard limit of 1024 characters — descriptions over that will be truncated, so stay comfortably under it.

Here are some tips that we've found to work well in writing these descriptions:
- The skill should be phrased in the imperative -- "Use this skill for" rather than "this skill does"
- The skill description should focus on the user's intent, what they are trying to achieve, vs. the implementation details of how the skill works.
- The description competes with other skills for Claude's attention — make it distinctive and immediately recognizable.
- If you're getting lots of failures after repeated attempts, change things up. Try different sentence structures or wordings.

I'd encourage you to be creative and mix up the style in different iterations since you'll have multiple opportunities to try different approaches and we'll just grab the highest-scoring one at the end. 

Please respond with only the new description text in <new_description> tags, nothing else."""

    text = _call_claude(prompt, model)

    match = re.search(r"<new_description>(.*?)</new_description>", text, re.DOTALL)
    description = match.group(1).strip().strip('"') if match else text.strip().strip('"')

    transcript: dict = {
        "iteration": iteration,
        "prompt": prompt,
        "response": text,
        "parsed_description": description,
        "char_count": len(description),
        "over_limit": len(description) > 1024,
    }

    # Safety net: the prompt already states the 1024-char hard limit, but if
    # the model blew past it anyway, make one fresh single-turn call that
    # quotes the too-long version and asks for a shorter rewrite. (The old
    # SDK path did this as a true multi-turn; \`claude -p\` is one-shot, so we
    # inline the prior output into the new prompt instead.)
    if len(description) > 1024:
        shorten_prompt = (
            f"{prompt}\\n\\n"
            f"---\\n\\n"
            f"A previous attempt produced this description, which at "
            f"{len(description)} characters is over the 1024-character hard limit:\\n\\n"
            f'"{description}"\\n\\n'
            f"Rewrite it to be under 1024 characters while keeping the most "
            f"important trigger words and intent coverage. Respond with only "
            f"the new description in <new_description> tags."
        )
        shorten_text = _call_claude(shorten_prompt, model)
        match = re.search(r"<new_description>(.*?)</new_description>", shorten_text, re.DOTALL)
        shortened = match.group(1).strip().strip('"') if match else shorten_text.strip().strip('"')

        transcript["rewrite_prompt"] = shorten_prompt
        transcript["rewrite_response"] = shorten_text
        transcript["rewrite_description"] = shortened
        transcript["rewrite_char_count"] = len(shortened)
        description = shortened

    transcript["final_description"] = description

    if log_dir:
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"improve_iter_{iteration or 'unknown'}.json"
        log_file.write_text(json.dumps(transcript, indent=2))

    return description


def main():
    parser = argparse.ArgumentParser(description="Improve a skill description based on eval results")
    parser.add_argument("--eval-results", required=True, help="Path to eval results JSON (from run_eval.py)")
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument("--history", default=None, help="Path to history JSON (previous attempts)")
    parser.add_argument("--model", required=True, help="Model for improvement")
    parser.add_argument("--verbose", action="store_true", help="Print thinking to stderr")
    args = parser.parse_args()

    skill_path = Path(args.skill_path)
    if not (skill_path / "SKILL.md").exists():
        print(f"Error: No SKILL.md found at {skill_path}", file=sys.stderr)
        sys.exit(1)

    eval_results = json.loads(Path(args.eval_results).read_text())
    history = []
    if args.history:
        history = json.loads(Path(args.history).read_text())

    name, _, content = parse_skill_md(skill_path)
    current_description = eval_results["description"]

    if args.verbose:
        print(f"Current: {current_description}", file=sys.stderr)
        print(f"Score: {eval_results['summary']['passed']}/{eval_results['summary']['total']}", file=sys.stderr)

    new_description = improve_description(
        skill_name=name,
        skill_content=content,
        current_description=current_description,
        eval_results=eval_results,
        history=history,
        model=args.model,
    )

    if args.verbose:
        print(f"Improved: {new_description}", file=sys.stderr)

    # Output as JSON with both the new description and updated history
    output = {
        "description": new_description,
        "history": history + [{
            "description": current_description,
            "passed": eval_results["summary"]["passed"],
            "failed": eval_results["summary"]["failed"],
            "total": eval_results["summary"]["total"],
            "results": eval_results["results"],
        }],
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
`

export const QUICK_VALIDATE_PY = `#!/usr/bin/env python3
"""
Quick validation script for skills - minimal version
"""

import sys
import os
import re
import yaml
from pathlib import Path

def validate_skill(skill_path):
    """Basic validation of a skill"""
    skill_path = Path(skill_path)

    # Check SKILL.md exists
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        return False, "SKILL.md not found"

    # Read and validate frontmatter
    content = skill_md.read_text()
    if not content.startswith('---'):
        return False, "No YAML frontmatter found"

    # Extract frontmatter
    match = re.match(r'^---\\n(.*?)\\n---', content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text = match.group(1)

    # Parse YAML frontmatter
    try:
        frontmatter = yaml.safe_load(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, "Frontmatter must be a YAML dictionary"
    except yaml.YAMLError as e:
        return False, f"Invalid YAML in frontmatter: {e}"

    # Define allowed properties
    ALLOWED_PROPERTIES = {'name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility'}

    # Check for unexpected properties (excluding nested keys under metadata)
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        return False, (
            f"Unexpected key(s) in SKILL.md frontmatter: {', '.join(sorted(unexpected_keys))}. "
            f"Allowed properties are: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    # Check required fields
    if 'name' not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if 'description' not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    # Extract name for validation
    name = frontmatter.get('name', '')
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if name:
        # Check naming convention (kebab-case: lowercase with hyphens)
        if not re.match(r'^[a-z0-9-]+$', name):
            return False, f"Name '{name}' should be kebab-case (lowercase letters, digits, and hyphens only)"
        if name.startswith('-') or name.endswith('-') or '--' in name:
            return False, f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens"
        # Check name length (max 64 characters per spec)
        if len(name) > 64:
            return False, f"Name is too long ({len(name)} characters). Maximum is 64 characters."

    # Extract and validate description
    description = frontmatter.get('description', '')
    if not isinstance(description, str):
        return False, f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if description:
        # Check for angle brackets
        if '<' in description or '>' in description:
            return False, "Description cannot contain angle brackets (< or >)"
        # Check description length (max 1024 characters per spec)
        if len(description) > 1024:
            return False, f"Description is too long ({len(description)} characters). Maximum is 1024 characters."

    # Validate compatibility field if present (optional)
    compatibility = frontmatter.get('compatibility', '')
    if compatibility:
        if not isinstance(compatibility, str):
            return False, f"Compatibility must be a string, got {type(compatibility).__name__}"
        if len(compatibility) > 500:
            return False, f"Compatibility is too long ({len(compatibility)} characters). Maximum is 500 characters."

    return True, "Skill is valid!"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)
    
    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)`

export const GENERATE_REPORT_PY = `#!/usr/bin/env python3
"""Generate an HTML report from run_loop.py output.

Takes the JSON output from run_loop.py and generates a visual HTML report
showing each description attempt with check/x for each test case.
Distinguishes between train and test queries.
"""

import argparse
import html
import json
import sys
from pathlib import Path


def generate_html(data: dict, auto_refresh: bool = False, skill_name: str = "") -> str:
    """Generate HTML report from loop output data. If auto_refresh is True, adds a meta refresh tag."""
    history = data.get("history", [])
    holdout = data.get("holdout", 0)
    title_prefix = html.escape(skill_name + " \\u2014 ") if skill_name else ""

    # Get all unique queries from train and test sets, with should_trigger info
    train_queries: list[dict] = []
    test_queries: list[dict] = []
    if history:
        for r in history[0].get("train_results", history[0].get("results", [])):
            train_queries.append({"query": r["query"], "should_trigger": r.get("should_trigger", True)})
        if history[0].get("test_results"):
            for r in history[0].get("test_results", []):
                test_queries.append({"query": r["query"], "should_trigger": r.get("should_trigger", True)})

    refresh_tag = '    <meta http-equiv="refresh" content="5">\\n' if auto_refresh else ""

    html_parts = ["""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
""" + refresh_tag + """    <title>""" + title_prefix + """Skill Description Optimization</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600&family=Lora:wght@400;500&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Lora', Georgia, serif;
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
            background: #faf9f5;
            color: #141413;
        }
        h1 { font-family: 'Poppins', sans-serif; color: #141413; }
        .explainer {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid #e8e6dc;
            color: #b0aea5;
            font-size: 0.875rem;
            line-height: 1.6;
        }
        .summary {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid #e8e6dc;
        }
        .summary p { margin: 5px 0; }
        .best { color: #788c5d; font-weight: bold; }
        .table-container {
            overflow-x: auto;
            width: 100%;
        }
        table {
            border-collapse: collapse;
            background: white;
            border: 1px solid #e8e6dc;
            border-radius: 6px;
            font-size: 12px;
            min-width: 100%;
        }
        th, td {
            padding: 8px;
            text-align: left;
            border: 1px solid #e8e6dc;
            white-space: normal;
            word-wrap: break-word;
        }
        th {
            font-family: 'Poppins', sans-serif;
            background: #141413;
            color: #faf9f5;
            font-weight: 500;
        }
        th.test-col {
            background: #6a9bcc;
        }
        th.query-col { min-width: 200px; }
        td.description {
            font-family: monospace;
            font-size: 11px;
            word-wrap: break-word;
            max-width: 400px;
        }
        td.result {
            text-align: center;
            font-size: 16px;
            min-width: 40px;
        }
        td.test-result {
            background: #f0f6fc;
        }
        .pass { color: #788c5d; }
        .fail { color: #c44; }
        .rate {
            font-size: 9px;
            color: #b0aea5;
            display: block;
        }
        tr:hover { background: #faf9f5; }
        .score {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 11px;
        }
        .score-good { background: #eef2e8; color: #788c5d; }
        .score-ok { background: #fef3c7; color: #d97706; }
        .score-bad { background: #fceaea; color: #c44; }
        .train-label { color: #b0aea5; font-size: 10px; }
        .test-label { color: #6a9bcc; font-size: 10px; font-weight: bold; }
        .best-row { background: #f5f8f2; }
        th.positive-col { border-bottom: 3px solid #788c5d; }
        th.negative-col { border-bottom: 3px solid #c44; }
        th.test-col.positive-col { border-bottom: 3px solid #788c5d; }
        th.test-col.negative-col { border-bottom: 3px solid #c44; }
        .legend { font-family: 'Poppins', sans-serif; display: flex; gap: 20px; margin-bottom: 10px; font-size: 13px; align-items: center; }
        .legend-item { display: flex; align-items: center; gap: 6px; }
        .legend-swatch { width: 16px; height: 16px; border-radius: 3px; display: inline-block; }
        .swatch-positive { background: #141413; border-bottom: 3px solid #788c5d; }
        .swatch-negative { background: #141413; border-bottom: 3px solid #c44; }
        .swatch-test { background: #6a9bcc; }
        .swatch-train { background: #141413; }
    </style>
</head>
<body>
    <h1>""" + title_prefix + """Skill Description Optimization</h1>
    <div class="explainer">
        <strong>Optimizing your skill's description.</strong> This page updates automatically as Claude tests different versions of your skill's description. Each row is an iteration — a new description attempt. The columns show test queries: green checkmarks mean the skill triggered correctly (or correctly didn't trigger), red crosses mean it got it wrong. The "Train" score shows performance on queries used to improve the description; the "Test" score shows performance on held-out queries the optimizer hasn't seen. When it's done, Claude will apply the best-performing description to your skill.
    </div>
"""]

    # Summary section
    best_test_score = data.get('best_test_score')
    best_train_score = data.get('best_train_score')
    html_parts.append(f"""
    <div class="summary">
        <p><strong>Original:</strong> {html.escape(data.get('original_description', 'N/A'))}</p>
        <p class="best"><strong>Best:</strong> {html.escape(data.get('best_description', 'N/A'))}</p>
        <p><strong>Best Score:</strong> {data.get('best_score', 'N/A')} {'(test)' if best_test_score else '(train)'}</p>
        <p><strong>Iterations:</strong> {data.get('iterations_run', 0)} | <strong>Train:</strong> {data.get('train_size', '?')} | <strong>Test:</strong> {data.get('test_size', '?')}</p>
    </div>
""")

    # Legend
    html_parts.append("""
    <div class="legend">
        <span style="font-weight:600">Query columns:</span>
        <span class="legend-item"><span class="legend-swatch swatch-positive"></span> Should trigger</span>
        <span class="legend-item"><span class="legend-swatch swatch-negative"></span> Should NOT trigger</span>
        <span class="legend-item"><span class="legend-swatch swatch-train"></span> Train</span>
        <span class="legend-item"><span class="legend-swatch swatch-test"></span> Test</span>
    </div>
""")

    # Table header
    html_parts.append("""
    <div class="table-container">
    <table>
        <thead>
            <tr>
                <th>Iter</th>
                <th>Train</th>
                <th>Test</th>
                <th class="query-col">Description</th>
""")

    # Add column headers for train queries
    for qinfo in train_queries:
        polarity = "positive-col" if qinfo["should_trigger"] else "negative-col"
        html_parts.append(f'                <th class="{polarity}">{html.escape(qinfo["query"])}</th>\\n')

    # Add column headers for test queries (different color)
    for qinfo in test_queries:
        polarity = "positive-col" if qinfo["should_trigger"] else "negative-col"
        html_parts.append(f'                <th class="test-col {polarity}">{html.escape(qinfo["query"])}</th>\\n')

    html_parts.append("""            </tr>
        </thead>
        <tbody>
""")

    # Find best iteration for highlighting
    if test_queries:
        best_iter = max(history, key=lambda h: h.get("test_passed") or 0).get("iteration")
    else:
        best_iter = max(history, key=lambda h: h.get("train_passed", h.get("passed", 0))).get("iteration")

    # Add rows for each iteration
    for h in history:
        iteration = h.get("iteration", "?")
        train_passed = h.get("train_passed", h.get("passed", 0))
        train_total = h.get("train_total", h.get("total", 0))
        test_passed = h.get("test_passed")
        test_total = h.get("test_total")
        description = h.get("description", "")
        train_results = h.get("train_results", h.get("results", []))
        test_results = h.get("test_results", [])

        # Create lookups for results by query
        train_by_query = {r["query"]: r for r in train_results}
        test_by_query = {r["query"]: r for r in test_results} if test_results else {}

        # Compute aggregate correct/total runs across all retries
        def aggregate_runs(results: list[dict]) -> tuple[int, int]:
            correct = 0
            total = 0
            for r in results:
                runs = r.get("runs", 0)
                triggers = r.get("triggers", 0)
                total += runs
                if r.get("should_trigger", True):
                    correct += triggers
                else:
                    correct += runs - triggers
            return correct, total

        train_correct, train_runs = aggregate_runs(train_results)
        test_correct, test_runs = aggregate_runs(test_results)

        # Determine score classes
        def score_class(correct: int, total: int) -> str:
            if total > 0:
                ratio = correct / total
                if ratio >= 0.8:
                    return "score-good"
                elif ratio >= 0.5:
                    return "score-ok"
            return "score-bad"

        train_class = score_class(train_correct, train_runs)
        test_class = score_class(test_correct, test_runs)

        row_class = "best-row" if iteration == best_iter else ""

        html_parts.append(f"""            <tr class="{row_class}">
                <td>{iteration}</td>
                <td><span class="score {train_class}">{train_correct}/{train_runs}</span></td>
                <td><span class="score {test_class}">{test_correct}/{test_runs}</span></td>
                <td class="description">{html.escape(description)}</td>
""")

        # Add result for each train query
        for qinfo in train_queries:
            r = train_by_query.get(qinfo["query"], {})
            did_pass = r.get("pass", False)
            triggers = r.get("triggers", 0)
            runs = r.get("runs", 0)

            icon = "✓" if did_pass else "✗"
            css_class = "pass" if did_pass else "fail"

            html_parts.append(f'                <td class="result {css_class}">{icon}<span class="rate">{triggers}/{runs}</span></td>\\n')

        # Add result for each test query (with different background)
        for qinfo in test_queries:
            r = test_by_query.get(qinfo["query"], {})
            did_pass = r.get("pass", False)
            triggers = r.get("triggers", 0)
            runs = r.get("runs", 0)

            icon = "✓" if did_pass else "✗"
            css_class = "pass" if did_pass else "fail"

            html_parts.append(f'                <td class="result test-result {css_class}">{icon}<span class="rate">{triggers}/{runs}</span></td>\\n')

        html_parts.append("            </tr>\\n")

    html_parts.append("""        </tbody>
    </table>
    </div>
""")

    html_parts.append("""
</body>
</html>
""")

    return "".join(html_parts)


def main():
    parser = argparse.ArgumentParser(description="Generate HTML report from run_loop output")
    parser.add_argument("input", help="Path to JSON output from run_loop.py (or - for stdin)")
    parser.add_argument("-o", "--output", default=None, help="Output HTML file (default: stdout)")
    parser.add_argument("--skill-name", default="", help="Skill name to include in the report title")
    args = parser.parse_args()

    if args.input == "-":
        data = json.load(sys.stdin)
    else:
        data = json.loads(Path(args.input).read_text())

    html_output = generate_html(data, skill_name=args.skill_name)

    if args.output:
        Path(args.output).write_text(html_output)
        print(f"Report written to {args.output}", file=sys.stderr)
    else:
        print(html_output)


if __name__ == "__main__":
    main()
`

export const PACKAGE_SKILL_PY = `#!/usr/bin/env python3
"""
Skill Packager - Creates a distributable .skill file of a skill folder

Usage:
    python utils/package_skill.py <path/to/skill-folder> [output-directory]

Example:
    python utils/package_skill.py skills/public/my-skill
    python utils/package_skill.py skills/public/my-skill ./dist
"""

import fnmatch
import sys
import zipfile
from pathlib import Path
from scripts.quick_validate import validate_skill

# Patterns to exclude when packaging skills.
EXCLUDE_DIRS = {"__pycache__", "node_modules"}
EXCLUDE_GLOBS = {"*.pyc"}
EXCLUDE_FILES = {".DS_Store"}
# Directories excluded only at the skill root (not when nested deeper).
ROOT_EXCLUDE_DIRS = {"evals"}


def should_exclude(rel_path: Path) -> bool:
    """Check if a path should be excluded from packaging."""
    parts = rel_path.parts
    if any(part in EXCLUDE_DIRS for part in parts):
        return True
    # rel_path is relative to skill_path.parent, so parts[0] is the skill
    # folder name and parts[1] (if present) is the first subdir.
    if len(parts) > 1 and parts[1] in ROOT_EXCLUDE_DIRS:
        return True
    name = rel_path.name
    if name in EXCLUDE_FILES:
        return True
    return any(fnmatch.fnmatch(name, pat) for pat in EXCLUDE_GLOBS)


def package_skill(skill_path, output_dir=None):
    """
    Package a skill folder into a .skill file.

    Args:
        skill_path: Path to the skill folder
        output_dir: Optional output directory for the .skill file (defaults to current directory)

    Returns:
        Path to the created .skill file, or None if error
    """
    skill_path = Path(skill_path).resolve()

    # Validate skill folder exists
    if not skill_path.exists():
        print(f"❌ Error: Skill folder not found: {skill_path}")
        return None

    if not skill_path.is_dir():
        print(f"❌ Error: Path is not a directory: {skill_path}")
        return None

    # Validate SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        print(f"❌ Error: SKILL.md not found in {skill_path}")
        return None

    # Run validation before packaging
    print("🔍 Validating skill...")
    valid, message = validate_skill(skill_path)
    if not valid:
        print(f"❌ Validation failed: {message}")
        print("   Please fix the validation errors before packaging.")
        return None
    print(f"✅ {message}\\n")

    # Determine output location
    skill_name = skill_path.name
    if output_dir:
        output_path = Path(output_dir).resolve()
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        output_path = Path.cwd()

    skill_filename = output_path / f"{skill_name}.skill"

    # Create the .skill file (zip format)
    try:
        with zipfile.ZipFile(skill_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Walk through the skill directory, excluding build artifacts
            for file_path in skill_path.rglob('*'):
                if not file_path.is_file():
                    continue
                arcname = file_path.relative_to(skill_path.parent)
                if should_exclude(arcname):
                    print(f"  Skipped: {arcname}")
                    continue
                zipf.write(file_path, arcname)
                print(f"  Added: {arcname}")

        print(f"\\n✅ Successfully packaged skill to: {skill_filename}")
        return skill_filename

    except Exception as e:
        print(f"❌ Error creating .skill file: {e}")
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python utils/package_skill.py <path/to/skill-folder> [output-directory]")
        print("\\nExample:")
        print("  python utils/package_skill.py skills/public/my-skill")
        print("  python utils/package_skill.py skills/public/my-skill ./dist")
        sys.exit(1)

    skill_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"📦 Packaging skill: {skill_path}")
    if output_dir:
        print(f"   Output directory: {output_dir}")
    print()

    result = package_skill(skill_path, output_dir)

    if result:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
`

export const UTILS_PY = `"""Shared utilities for skill-creator scripts."""

from pathlib import Path



def parse_skill_md(skill_path: Path) -> tuple[str, str, str]:
    """Parse a SKILL.md file, returning (name, description, full_content)."""
    content = (skill_path / "SKILL.md").read_text()
    lines = content.split("\\n")

    if lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter (no opening ---)")

    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        raise ValueError("SKILL.md missing frontmatter (no closing ---)")

    name = ""
    description = ""
    frontmatter_lines = lines[1:end_idx]
    i = 0
    while i < len(frontmatter_lines):
        line = frontmatter_lines[i]
        if line.startswith("name:"):
            name = line[len("name:"):].strip().strip('"').strip("'")
        elif line.startswith("description:"):
            value = line[len("description:"):].strip()
            # Handle YAML multiline indicators (>, |, >-, |-)
            if value in (">", "|", ">-", "|-"):
                continuation_lines: list[str] = []
                i += 1
                while i < len(frontmatter_lines) and (frontmatter_lines[i].startswith("  ") or frontmatter_lines[i].startswith("\\t")):
                    continuation_lines.append(frontmatter_lines[i].strip())
                    i += 1
                description = " ".join(continuation_lines)
                continue
            else:
                description = value.strip('"').strip("'")
        i += 1

    return name, description, content
`

