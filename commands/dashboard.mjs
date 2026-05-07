#!/usr/bin/env node
/**
 * dashboard.mjs — Generate HTML dashboard for AI Memory Bridge
 * Creates a static HTML file with all experiences, stats, and search
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { detectProject, getStoragePaths } from '../lib/detect-project.mjs';

function loadExperiences() {
  const project = detectProject();
  const paths = getStoragePaths(project);
  const experiences = [];
  
  // Load project experiences
  if (existsSync(paths.project.experiences)) {
    for (const file of readdirSync(paths.project.experiences).filter(f => f.endsWith('.json'))) {
      try {
        const exp = JSON.parse(readFileSync(resolve(paths.project.experiences, file), 'utf8'));
        experiences.push(exp);
      } catch {}
    }
  }
  
  // Load global experiences
  if (existsSync(paths.global.experiences)) {
    for (const file of readdirSync(paths.global.experiences).filter(f => f.endsWith('.json'))) {
      try {
        const exp = JSON.parse(readFileSync(resolve(paths.global.experiences, file), 'utf8'));
        experiences.push(exp);
      } catch {}
    }
  }
  
  return experiences;
}

function loadDNA() {
  const project = detectProject();
  const paths = getStoragePaths(project);
  
  if (existsSync(paths.project.dna)) {
    try {
      return JSON.parse(readFileSync(paths.project.dna, 'utf8'));
    } catch {}
  }
  return null;
}

function generateHTML(experiences, dna) {
  const stats = {
    total: experiences.length,
    pitfalls: experiences.filter(e => e.type === 'pitfall').length,
    errors: experiences.filter(e => e.type === 'error').length,
    patterns: experiences.filter(e => e.type === 'pattern' || e.type === 'success').length,
    highConfidence: experiences.filter(e => e.confidence >= 0.8).length,
    multiVerified: experiences.filter(e => e.frequency > 1).length
  };
  
  const sortedByFreq = [...experiences].sort((a, b) => b.frequency - a.frequency).slice(0, 10);
  const sortedByConfidence = [...experiences].sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  
  const experiencesJSON = JSON.stringify(experiences);
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Memory Bridge Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --border: #30363d;
      --text: #c9d1d9;
      --text-secondary: #8b949e;
      --accent: #58a6ff;
      --accent-green: #3fb950;
      --accent-yellow: #d29922;
      --accent-red: #f85149;
      --accent-purple: #a371f7;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }
    
    h1 {
      font-size: 2rem;
      color: var(--accent);
      margin-bottom: 0.5rem;
    }
    
    .subtitle {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .stat-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      transition: transform 0.2s;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
    }
    
    .stat-value {
      font-size: 2.5rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }
    
    .stat-label {
      color: var(--text-secondary);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .stat-total { color: var(--accent); }
    .stat-pitfall { color: var(--accent-red); }
    .stat-error { color: var(--accent-yellow); }
    .stat-pattern { color: var(--accent-green); }
    .stat-confidence { color: var(--accent-purple); }
    
    .section {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .section-title {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .search-box {
      width: 100%;
      padding: 0.75rem 1rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    
    .search-box:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .filters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    
    .filter-btn {
      padding: 0.5rem 1rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 20px;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }
    
    .filter-btn:hover, .filter-btn.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    
    th {
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      user-select: none;
    }
    
    th:hover {
      color: var(--accent);
    }
    
    tr:hover {
      background: var(--bg-tertiary);
    }
    
    .type-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .type-pitfall { background: rgba(248, 81, 73, 0.2); color: var(--accent-red); }
    .type-error { background: rgba(210, 153, 34, 0.2); color: var(--accent-yellow); }
    .type-pattern { background: rgba(63, 185, 80, 0.2); color: var(--accent-green); }
    .type-success { background: rgba(63, 185, 80, 0.2); color: var(--accent-green); }
    
    .confidence-bar {
      width: 100%;
      height: 6px;
      background: var(--bg-tertiary);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .confidence-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-red), var(--accent-yellow), var(--accent-green));
      border-radius: 3px;
      transition: width 0.3s;
    }
    
    .lesson-text {
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .lesson-text:hover {
      white-space: normal;
      overflow: visible;
    }
    
    .tag {
      display: inline-block;
      padding: 0.15rem 0.4rem;
      background: var(--bg-tertiary);
      border-radius: 4px;
      font-size: 0.75rem;
      margin-right: 0.25rem;
      color: var(--text-secondary);
    }
    
    .top-list {
      list-style: none;
    }
    
    .top-list li {
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .top-list li:last-child {
      border-bottom: none;
    }
    
    .top-rank {
      font-weight: bold;
      color: var(--accent);
      margin-right: 1rem;
      min-width: 24px;
    }
    
    .top-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .top-value {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    
    @media (max-width: 768px) {
      .two-column {
        grid-template-columns: 1fr;
      }
      
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      th, td {
        padding: 0.5rem;
        font-size: 0.85rem;
      }
      
      .lesson-text {
        max-width: 150px;
      }
    }
    
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }
    
    .dna-section {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    
    .dna-item {
      background: var(--bg-tertiary);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
    }
    
    .dna-label {
      color: var(--text-secondary);
      font-size: 0.75rem;
      text-transform: uppercase;
      margin-bottom: 0.25rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧠 AI Memory Bridge Dashboard</h1>
      <p class="subtitle">
        Project: ${dna?.name || 'Unknown'} | 
        Generated: ${new Date().toLocaleString('zh-CN')}
      </p>
    </header>
    
    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value stat-total">${stats.total}</div>
        <div class="stat-label">Total Experiences</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-pitfall">${stats.pitfalls}</div>
        <div class="stat-label">Pitfalls</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-error">${stats.errors}</div>
        <div class="stat-label">Errors</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-pattern">${stats.patterns}</div>
        <div class="stat-label">Patterns</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-confidence">${stats.highConfidence}</div>
        <div class="stat-label">High Confidence</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-total">${stats.multiVerified}</div>
        <div class="stat-label">Multi Verified</div>
      </div>
    </div>
    
    <!-- DNA -->
    ${dna ? `
    <div class="section">
      <div class="section-title">🧬 Project DNA</div>
      <div class="dna-section">
        ${dna.stack?.map(s => `<div class="dna-item">
          <div class="dna-label">Stack</div>
          ${s}
        </div>`).join('') || ''}
        ${dna.goal ? `<div class="dna-item">
          <div class="dna-label">Goal</div>
          ${dna.goal}
        </div>` : ''}
        ${dna.constraints?.map(c => `<div class="dna-item">
          <div class="dna-label">Constraint</div>
          ${c}
        </div>`).join('') || ''}
      </div>
    </div>
    ` : ''}
    
    <!-- Experience Library -->
    <div class="section">
      <div class="section-title">📚 Experience Library</div>
      
      <input type="text" 
             class="search-box" 
             id="searchBox" 
             placeholder="Search experiences... (tool, keyword, tag)">
      
      <div class="filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="pitfall">Pitfalls</button>
        <button class="filter-btn" data-filter="error">Errors</button>
        <button class="filter-btn" data-filter="pattern">Patterns</button>
        <button class="filter-btn" data-filter="high-confidence">High Confidence (>=0.8)</button>
      </div>
      
      <div id="experienceTable">
        <!-- Table will be populated by JS -->
      </div>
    </div>
    
    <!-- Top Lists -->
    <div class="two-column">
      <div class="section">
        <div class="section-title">🔥 Top Pitfalls by Frequency</div>
        <ul class="top-list">
          ${sortedByFreq.length > 0 ? sortedByFreq.map((e, i) => `
            <li>
              <span class="top-rank">${i + 1}</span>
              <span class="top-name">${e.lesson?.what_failed || e.outcome?.description || 'Unknown'}</span>
              <span class="top-value">${e.frequency}x</span>
            </li>
          `).join('') : '<li class="empty-state">No experiences yet</li>'}
        </ul>
      </div>
      
      <div class="section">
        <div class="section-title">⭐ Most Confident</div>
        <ul class="top-list">
          ${sortedByConfidence.length > 0 ? sortedByConfidence.map((e, i) => `
            <li>
              <span class="top-rank">${i + 1}</span>
              <span class="top-name">${e.lesson?.what_failed || e.outcome?.description || 'Unknown'}</span>
              <span class="top-value">${Math.round(e.confidence * 100)}%</span>
            </li>
          `).join('') : '<li class="empty-state">No experiences yet</li>'}
        </ul>
      </div>
    </div>
  </div>
  
  <script>
    const experiences = ${experiencesJSON};
    let currentFilter = 'all';
    let currentSort = { field: 'updated_at', direction: 'desc' };
    
    function renderTable(data) {
      const container = document.getElementById('experienceTable');
      
      if (data.length === 0) {
        container.innerHTML = '<div class="empty-state">No experiences match your criteria</div>';
        return;
      }
      
      const html = \`
        <table>
          <thead>
            <tr>
              <th onclick="sortBy('type')">Type </th>
              <th onclick="sortBy('trigger.tool')">Tool </th>
              <th>Lesson</th>
              <th onclick="sortBy('confidence')">Confidence </th>
              <th onclick="sortBy('frequency')">Freq </th>
              <th>Tags</th>
              <th onclick="sortBy('updated_at')">Updated </th>
            </tr>
          </thead>
          <tbody>
            \${data.map(exp => \`
              <tr>
                <td>
                  <span class="type-badge type-\${exp.type}">
                    \${exp.type}
                  </span>
                </td>
                <td>\${exp.trigger?.tool || '-'}</td>
                <td class="lesson-text" title="\${exp.lesson?.what_failed || ''}">
                  \${exp.lesson?.what_failed || exp.outcome?.description || '-'}
                </td>
                <td>
                  <div style="display:flex;align-items:center;gap:0.5rem">
                    <div class="confidence-bar" style="width:60px">
                      <div class="confidence-fill" style="width:\${exp.confidence * 100}%"></div>
                    </div>
                    \${Math.round(exp.confidence * 100)}%
                  </div>
                </td>
                <td>\${exp.frequency || 1}</td>
                <td>
                  \${(exp.metadata?.tags || []).slice(0, 3).map(t => 
                    <span class="tag">\${t}</span>
                  ).join('')}
                </td>
                <td>\${new Date(exp.updated_at).toLocaleDateString()}</td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      \`;
      
      container.innerHTML = html;
    }
    
    function filterExperiences() {
      const searchTerm = document.getElementById('searchBox').value.toLowerCase();
      
      let filtered = experiences.filter(exp => {
        // Filter by type
        if (currentFilter !== 'all') {
          if (currentFilter === 'high-confidence') {
            if (exp.confidence < 0.8) return false;
          } else if (exp.type !== currentFilter) {
            return false;
          }
        }
        
        // Filter by search term
        if (searchTerm) {
          const text = \`
            \${exp.type} 
            \${exp.trigger?.tool || ''} 
            \${exp.trigger?.action_pattern || ''}
            \${exp.lesson?.what_failed || ''}
            \${exp.lesson?.better_approach || ''}
            \${(exp.metadata?.tags || []).join(' ')}
          \`.toLowerCase();
          return text.includes(searchTerm);
        }
        
        return true;
      });
      
      // Sort
      filtered.sort((a, b) => {
        let valA, valB;
        
        switch (currentSort.field) {
          case 'type':
            valA = a.type; valB = b.type;
            break;
          case 'trigger.tool':
            valA = a.trigger?.tool || ''; valB = b.trigger?.tool || '';
            break;
          case 'confidence':
            valA = a.confidence; valB = b.confidence;
            break;
          case 'frequency':
            valA = a.frequency || 1; valB = b.frequency || 1;
            break;
          case 'updated_at':
            valA = new Date(a.updated_at); valB = new Date(b.updated_at);
            break;
          default:
            return 0;
        }
        
        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
      
      renderTable(filtered);
    }
    
    function sortBy(field) {
      if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.field = field;
        currentSort.direction = 'desc';
      }
      filterExperiences();
    }
    
    // Event listeners
    document.getElementById('searchBox').addEventListener('input', filterExperiences);
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        filterExperiences();
      });
    });
    
    // Initial render
    filterExperiences();
  </script>
</body>
</html>`;
}

function main() {
  try {
    console.log('🎨 Generating AI Memory Bridge Dashboard...\n');
    
    const experiences = loadExperiences();
    const dna = loadDNA();
    
    console.log(`Found ${experiences.length} experiences`);
    console.log(`DNA: ${dna ? dna.name : 'not initialized'}`);
    
    const html = generateHTML(experiences, dna);
    
    const outputPath = resolve(process.cwd(), 'ai-memory-dashboard.html');
    writeFileSync(outputPath, html);
    
    console.log(`\n✅ Dashboard generated: ${outputPath}`);
    console.log(`   Open this file in your browser to view the dashboard`);
    console.log(`   Features: search, filter, sort, statistics`);
    
  } catch (err) {
    console.error('❌ Failed to generate dashboard:', err.message);
    process.exit(1);
  }
}

main();
