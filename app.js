/* ============================================================
   EIOP – Enterprise Integration Orchestration Platform
   Main Application Logic
   ============================================================ */

'use strict';

/* ── Global State ── */
const STATE = {
  currentModule: 'dashboard',
  parsedServices: [],
  selectedAdapter: null,
  generatedConfig: null,
  rollbackTarget: null,
  logs: [],
  adapters: [],
};

/* ── Sample Data ── */
const SAMPLE_DOCS = {
  brd: `Business Requirements Document – E-Commerce Platform Integration v2.4
  
The system SHALL integrate with Salesforce CRM API v44 to synchronize customer profiles and order history in real-time.
Payment processing MUST use Stripe Payments API v3 with PCI-DSS compliance and webhook support for payment events.
The platform SHALL store product images and documents via AWS S3 v3 with presigned URL generation.
Optional: Twilio SMS API v2.1 for transactional SMS notifications upon order status updates.
The system SHOULD integrate with SendGrid v3 for email notification delivery.
Analytics reporting SHALL leverage Google Analytics Data API v1.
Authentication MUST be handled via Auth0 OAuth 2.0.`,

  api: `API Specification Document – Payment Gateway Integration
  
Base URL: https://api.stripe.com/v1
Authentication: Bearer Token (OAuth 2.0)
Required Endpoints:
  POST /v1/charges – Create charge (MANDATORY)
  POST /v1/refunds – Process refund (MANDATORY)
  GET  /v1/customers/{id} – Fetch customer (MANDATORY)
  POST /v1/webhooks – Register webhook (MANDATORY)
  GET  /v1/balance – Check balance (OPTIONAL)
Rate Limit: 100 req/sec
Retry Policy: Exponential backoff, max 3 retries`,

  sow: `Statement of Work – CRM Integration Project
  
Scope: Integrate HubSpot CRM v3 with existing ERP system.
Mandatory Services: HubSpot Contacts API, HubSpot Deals API, HubSpot Webhooks
Optional Services: HubSpot Analytics, Slack notifications for deal events
Integration Type: Real-time bidirectional sync via REST APIs
Auth Method: OAuth 2.0 with refresh token rotation
SLA: 99.9% uptime, <200ms response time`
};

const ADAPTERS_DATA = [
  { id: 1, name: 'Salesforce CRM', icon: '☁️', category: 'CRM', version: 'v44.0', status: 'stable', hooks: ['onConnect','onSync','onError','onDisconnect'], downloads: 1240, endpoints: 38, color: '#00a1e0' },
  { id: 2, name: 'Stripe Payments', icon: '💳', category: 'Payment', version: 'v3.0', status: 'stable', hooks: ['onCharge','onRefund','onWebhook','onError'], downloads: 2890, endpoints: 24, color: '#635bff' },
  { id: 3, name: 'AWS S3', icon: '🗃️', category: 'Storage', version: 'v3', status: 'stable', hooks: ['onUpload','onDownload','onDelete','onError'], downloads: 3760, endpoints: 18, color: '#ff9900' },
  { id: 4, name: 'Twilio SMS', icon: '📱', category: 'Messaging', version: 'v2.1', status: 'stable', hooks: ['onSend','onStatus','onError'], downloads: 980, endpoints: 12, color: '#f22f46' },
  { id: 5, name: 'SendGrid Email', icon: '📧', category: 'Messaging', version: 'v3', status: 'stable', hooks: ['onSend','onBounce','onOpen','onError'], downloads: 1670, endpoints: 16, color: '#1a82e2' },
  { id: 6, name: 'HubSpot CRM', icon: '🔶', category: 'CRM', version: 'v3', status: 'stable', hooks: ['onContact','onDeal','onSync','onError'], downloads: 775, endpoints: 30, color: '#ff7a59' },
  { id: 7, name: 'Auth0', icon: '🔐', category: 'Auth', version: 'v2', status: 'stable', hooks: ['onLogin','onLogout','onRefresh','onError'], downloads: 2100, endpoints: 22, color: '#eb5424' },
  { id: 8, name: 'PostgreSQL', icon: '🐘', category: 'Database', version: 'v15', status: 'stable', hooks: ['onQuery','onInsert','onUpdate','onError'], downloads: 4200, endpoints: 8, color: '#336791' },
  { id: 9, name: 'Google Analytics', icon: '📊', category: 'Analytics', version: 'v4', status: 'stable', hooks: ['onTrack','onReport','onError'], downloads: 1330, endpoints: 14, color: '#e37400' },
  { id: 10, name: 'Slack', icon: '💬', category: 'Messaging', version: 'v2', status: 'beta', hooks: ['onMessage','onEvent','onError'], downloads: 890, endpoints: 10, color: '#4a154b' },
  { id: 11, name: 'MySQL', icon: '🐬', category: 'Database', version: 'v8', status: 'stable', hooks: ['onQuery','onTransaction','onError'], downloads: 3100, endpoints: 8, color: '#4479a1' },
  { id: 12, name: 'Zendesk', icon: '🎫', category: 'CRM', version: 'v2', status: 'beta', hooks: ['onTicket','onUpdate','onError'], downloads: 440, endpoints: 20, color: '#03363d' },
];

const CONFIGS = {
  yaml: (src, tgt, pattern, auth) => `# EIOP Auto-Generated Configuration
# Source: ${src} → Target: ${tgt}
# Pattern: ${pattern} | Auth: ${auth}
# Generated: ${new Date().toISOString()}

integration:
  id: "eiop-${Math.random().toString(36).slice(2,8)}"
  name: "${src}-to-${tgt}-${pattern}"
  version: "1.0.0"
  pattern: "${pattern}"

source:
  adapter: "${src}"
  auth:
    method: "${auth}"
    token_url: "https://auth.${src}.com/oauth/token"
    client_id: "\${${src.toUpperCase()}_CLIENT_ID}"
    client_secret: "\${${src.toUpperCase()}_CLIENT_SECRET}"
  retry:
    max_attempts: 3
    backoff: "exponential"
    initial_delay_ms: 1000

target:
  adapter: "${tgt}"
  base_url: "https://api.${tgt}.com/v1"
  auth:
    method: "${auth}"
    api_key: "\${${tgt.toUpperCase()}_API_KEY}"
  timeout_ms: 5000

transforms:
  - type: "field_mapping"
    rules: "mapping_rules.json"
  - type: "data_validation"
    schema: "target_schema.json"

monitoring:
  health_check_interval: 30s
  alert_on_failure: true
  log_level: "INFO"`,

  json: (src, tgt, pattern, auth) => JSON.stringify({
    integration: { id: `eiop-${Math.random().toString(36).slice(2,8)}`, name: `${src}-to-${tgt}`, version: "1.0.0", pattern },
    source: { adapter: src, auth: { method: auth, client_id: `\${${src.toUpperCase()}_CLIENT_ID}` } },
    target: { adapter: tgt, auth: { method: auth, api_key: `\${${tgt.toUpperCase()}_API_KEY}` } },
    transforms: [{ type: "field_mapping" }, { type: "data_validation" }],
    monitoring: { log_level: "INFO", alert_on_failure: true }
  }, null, 2),

  env: (src, tgt) => `# EIOP Environment Variables
# Source: ${src.toUpperCase()}
${src.toUpperCase()}_CLIENT_ID=your_client_id_here
${src.toUpperCase()}_CLIENT_SECRET=your_client_secret_here
${src.toUpperCase()}_BASE_URL=https://api.${src}.com/v1

# Target: ${tgt.toUpperCase()}
${tgt.toUpperCase()}_API_KEY=your_api_key_here
${tgt.toUpperCase()}_WEBHOOK_SECRET=your_webhook_secret

# EIOP Core
EIOP_ENV=production
EIOP_LOG_LEVEL=INFO
EIOP_RETRY_MAX=3`
};

/* ── Module Navigation ── */
function switchModule(name) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const mod = document.getElementById(`module-${name}`);
  const nav = document.getElementById(`nav-${name}`);
  if (mod) mod.classList.add('active');
  if (nav) nav.classList.add('active');

  STATE.currentModule = name;
  document.getElementById('breadcrumb').textContent =
    { dashboard: 'Dashboard', parser: 'Requirement Parser', registry: 'Integration Registry',
      autoconfig: 'Auto-Configuration', simulation: 'Simulation & Testing', logs: 'Audit Logs' }[name] || name;

  if (name === 'registry') renderAdapters();
  if (name === 'logs') renderLogs();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchModule(item.dataset.module));
});

document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

/* ── Dashboard Counter Animation ── */
function animateCounter(el, target, duration = 1400) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = Math.floor(start).toLocaleString();
    if (start >= target) clearInterval(timer);
  }, 16);
}

function initDashboard() {
  animateCounter(document.getElementById('statDocs'), 847);
  animateCounter(document.getElementById('statAdapters'), 12);
  animateCounter(document.getElementById('statConfigs'), 3241);
  animateCounter(document.getElementById('statTests'), 18596);
  addLog('INFO', 'Dashboard initialized – all systems operational');
  addLog('SUCCESS', 'Pipeline health check completed – <span class="log-bold">6/6 stages</span> healthy');
}

/* ── Requirement Parser ── */
document.getElementById('parseTemplate').addEventListener('change', function () {
  if (this.value && SAMPLE_DOCS[this.value]) {
    document.getElementById('docTextarea').value = SAMPLE_DOCS[this.value];
    this.value = '';
    showToast('info', '📄', 'Sample document loaded', 'Edit and click Analyze to parse it.');
  }
});

document.querySelectorAll('.doc-type-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.doc-type-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

function runParser() {
  const text = document.getElementById('docTextarea').value.trim();
  if (!text) { showToast('warn', '⚠️', 'No document', 'Please paste or load a document first.'); return; }

  const btn = document.getElementById('parseBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon-inner">⏳</span> Analyzing…';

  addLog('INFO', `Parser started – document length: <span class="log-bold">${text.length} chars</span>`);

  setTimeout(() => {
    const results = parseDocument(text);
    STATE.parsedServices = results.services;
    renderParserResults(results);
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon-inner">🧠</span> Analyze Document';
    addLog('SUCCESS', `Parsing complete – <span class="log-bold">${results.services.length} services</span> detected, confidence: ${results.confidence}%`);
    showToast('success', '✅', 'Analysis complete', `${results.services.length} services detected.`);
  }, 1800);
}

function parseDocument(text) {
  const upper = text.toUpperCase();
  const allServices = [
    { name: 'Salesforce CRM', icon: '☁️', keywords: ['SALESFORCE'], version: 'v44', priority: 'mandatory' },
    { name: 'Stripe Payments', icon: '💳', keywords: ['STRIPE', 'PAYMENT'], version: 'v3', priority: 'mandatory' },
    { name: 'AWS S3', icon: '🗃️', keywords: ['AWS S3', 'S3'], version: 'v3', priority: 'mandatory' },
    { name: 'Twilio SMS', icon: '📱', keywords: ['TWILIO', 'SMS'], version: 'v2.1', priority: 'optional' },
    { name: 'SendGrid', icon: '📧', keywords: ['SENDGRID', 'EMAIL NOTIF'], version: 'v3', priority: 'optional' },
    { name: 'Auth0', icon: '🔐', keywords: ['AUTH0', 'OAUTH 2.0'], version: 'v2', priority: 'mandatory' },
    { name: 'HubSpot CRM', icon: '🔶', keywords: ['HUBSPOT'], version: 'v3', priority: 'mandatory' },
    { name: 'Google Analytics', icon: '📊', keywords: ['GOOGLE ANALYTICS', 'ANALYTICS'], version: 'v4', priority: 'optional' },
    { name: 'Slack', icon: '💬', keywords: ['SLACK'], version: 'v2', priority: 'optional' },
    { name: 'PostgreSQL', icon: '🐘', keywords: ['POSTGRESQL', 'POSTGRES'], version: 'v15', priority: 'mandatory' },
  ];

  const detected = allServices.filter(s => s.keywords.some(k => upper.includes(k)));

  // Override priority based on mandatory/optional language
  const mandatoryWords = ['SHALL', 'MUST', 'REQUIRED', 'MANDATORY'];
  const optionalWords = ['OPTIONAL', 'SHOULD', 'RECOMMENDED', 'MAY'];
  detected.forEach(s => {
    const idx = upper.indexOf(s.keywords[0]);
    if (idx > -1) {
      const ctx = upper.slice(Math.max(0, idx - 60), idx);
      if (optionalWords.some(w => ctx.includes(w))) s.priority = 'optional';
      else if (mandatoryWords.some(w => ctx.includes(w))) s.priority = 'mandatory';
    }
  });

  const endpoints = extractEndpoints(text);
  const entities = extractEntities(text);
  const words = text.split(/\s+/).length;
  const confidence = Math.min(98, 72 + detected.length * 3 + (endpoints.length > 0 ? 5 : 0));

  return { services: detected, endpoints, entities, confidence, wordCount: words };
}

function extractEndpoints(text) {
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const eps = [];
  const urlPattern = /(?:GET|POST|PUT|DELETE|PATCH)\s+(\/\S+)/gi;
  let match;
  while ((match = urlPattern.exec(text)) !== null) {
    const method = match[0].split(' ')[0].toUpperCase();
    eps.push({ method, url: match[1], service: 'Detected' });
  }
  if (eps.length === 0) {
    eps.push(
      { method: 'POST', url: '/v1/charges', service: 'Stripe' },
      { method: 'GET', url: '/v44/sobjects/Contact', service: 'Salesforce' },
      { method: 'POST', url: '/v3/mail/send', service: 'SendGrid' },
      { method: 'PUT', url: '/v3/contacts', service: 'HubSpot' }
    );
  }
  return eps;
}

function extractEntities(text) {
  const entityTypes = [
    { label: 'API', color: '#6366f1', pat: /\bAPI\b/gi },
    { label: 'Webhook', color: '#06b6d4', pat: /webhook/gi },
    { label: 'OAuth', color: '#8b5cf6', pat: /oauth/gi },
    { label: 'REST', color: '#10b981', pat: /\bREST\b/gi },
    { label: 'JSON', color: '#f59e0b', pat: /\bJSON\b/gi },
    { label: 'v3', color: '#f43f5e', pat: /\bv3\b/gi },
    { label: 'Real-time', color: '#22d3ee', pat: /real.?time/gi },
    { label: 'Sync', color: '#a78bfa', pat: /sync/gi },
    { label: 'Auth', color: '#34d399', pat: /auth(?!0)/gi },
    { label: 'Integration', color: '#fb923c', pat: /integrat/gi },
  ];
  return entityTypes.filter(e => e.pat.test(text));
}

function renderParserResults(results) {
  document.getElementById('parserResults').style.display = 'block';
  document.getElementById('nlpViz').style.display = 'block';
  document.getElementById('confVal').textContent = `${results.confidence}%`;

  // Services
  const sl = document.getElementById('servicesList');
  sl.innerHTML = results.services.map(s => `
    <div class="service-item">
      <div class="service-icon">${s.icon}</div>
      <div class="service-name">${s.name}</div>
      <div class="service-version">${s.version}</div>
      <span class="service-priority ${s.priority === 'mandatory' ? 'priority-mandatory' : 'priority-optional'}">
        ${s.priority}
      </span>
    </div>`).join('') || '<p style="color:var(--text-muted);font-size:13px;">No services detected.</p>';

  // Endpoints
  const el = document.getElementById('endpointsList');
  el.innerHTML = results.endpoints.map(e => `
    <div class="endpoint-item">
      <span class="endpoint-method method-${e.method.toLowerCase()}">${e.method}</span>
      <span class="endpoint-url">${e.url}</span>
      <span class="endpoint-service">${e.service}</span>
    </div>`).join('');

  // Entities
  const ec = document.getElementById('entitiesCloud');
  ec.innerHTML = results.entities.map(e => `
    <span class="entity-tag" style="background:${e.color}22;border-color:${e.color}55;color:${e.color}">${e.label}</span>`).join('');

  // NLP stages
  document.getElementById('tokenCount').textContent = `${results.wordCount} tokens`;
  document.getElementById('nerCount').textContent = `${results.entities.length} entities`;
  document.getElementById('intentType').textContent = 'Integration BRD';
  document.getElementById('serviceCount').textContent = `${results.services.length} found`;
  document.getElementById('priorityResult').textContent = `${results.services.filter(s=>s.priority==='mandatory').length} mandatory`;

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById(`tab-${this.dataset.tab}`).classList.add('active');
    });
  });
}

/* ── Integration Registry ── */
function renderAdapters(filter = '') {
  STATE.adapters = ADAPTERS_DATA;
  const search = (document.getElementById('adapterSearch')?.value || '').toLowerCase();
  const cat = document.getElementById('categoryFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';

  const filtered = ADAPTERS_DATA.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search) || a.category.toLowerCase().includes(search);
    const matchCat = !cat || a.category === cat;
    const matchStatus = !status || a.status === status;
    return matchSearch && matchCat && matchStatus;
  });

  const grid = document.getElementById('adaptersGrid');
  if (!grid) return;

  grid.innerHTML = filtered.map(a => `
    <div class="adapter-card" onclick="openAdapterDetail(${a.id})">
      <div class="adapter-header">
        <div class="adapter-logo" style="background:${a.color}22;">${a.icon}</div>
        <div>
          <div class="adapter-name">${a.name}</div>
          <div class="adapter-version">${a.version}</div>
        </div>
      </div>
      <span class="adapter-category badge ${a.status === 'stable' ? 'badge-green' : a.status === 'beta' ? 'badge-yellow' : 'badge-red'}">${a.category} · ${a.status}</span>
      <div class="adapter-hooks">${a.hooks.map(h => `<span class="hook-tag">${h}</span>`).join('')}</div>
      <div class="adapter-meta">
        <span>📡 ${a.endpoints} endpoints</span>
        <span>⬇️ ${a.downloads.toLocaleString()} installs</span>
      </div>
    </div>`).join('') || '<p style="color:var(--text-muted);padding:20px;grid-column:1/-1;">No adapters match your filters.</p>';
}

function filterAdapters() { renderAdapters(); }

function openAdapterDetail(id) {
  const adapter = ADAPTERS_DATA.find(a => a.id === id);
  if (!adapter) return;
  STATE.selectedAdapter = adapter;

  document.getElementById('modalIcon').textContent = adapter.icon;
  document.getElementById('modalIcon').style.background = adapter.color + '22';
  document.getElementById('modalName').textContent = adapter.name;
  document.getElementById('modalVersion').textContent = `Current: ${adapter.version} · ${adapter.status}`;

  // Versions
  const baseVer = parseFloat(adapter.version.replace('v', '')) || 1;
  document.getElementById('versionTimeline').innerHTML = [
    { v: adapter.version, date: 'Mar 2026', note: 'Current stable' },
    { v: `v${(baseVer - 0.1).toFixed(1)}`, date: 'Jan 2026', note: 'Bug fixes & performance' },
    { v: `v${(baseVer - 0.5).toFixed(1)}`, date: 'Oct 2025', note: 'New endpoints added' },
  ].map(v => `
    <div class="ver-item">
      <span class="ver-tag">${v.v}</span>
      <span class="ver-date">${v.date}</span>
      <span class="ver-note">${v.note}</span>
    </div>`).join('');

  // Hook lifecycle
  const allHooks = ['preFlight','onConnect','beforeRequest',...adapter.hooks,'afterResponse','onDisconnect'];
  document.getElementById('hookLifecycle').innerHTML = allHooks.map((h, i) => `
    <div class="hook-stage ${i > 0 && i < allHooks.length - 1 ? 'active' : ''}">
      <div class="hook-stage-icon">${['🚀','🔗','📤','⚡','📥','🔌'][Math.min(i,5)]}</div>
      <div>${h}</div>
    </div>`).join('');

  // Config schema
  document.getElementById('configSchema').textContent = JSON.stringify({
    adapter: adapter.name, version: adapter.version,
    auth: { type: 'oauth2', required: ['client_id','client_secret'] },
    config: { base_url: `https://api.${adapter.name.toLowerCase().replace(/\s/g,'-')}.com`, timeout: 5000, retry: { max: 3 } },
    hooks: adapter.hooks.reduce((acc, h) => { acc[h] = { enabled: true, async: false }; return acc; }, {})
  }, null, 2);

  document.getElementById('adapterModal').style.display = 'flex';
}

function openAddAdapter() { document.getElementById('addAdapterModal').style.display = 'flex'; }

function addNewAdapter() {
  const name = document.getElementById('newAdapterName').value.trim();
  const cat = document.getElementById('newAdapterCategory').value;
  const ver = document.getElementById('newAdapterVersion').value.trim() || 'v1.0.0';
  if (!name) { showToast('warn', '⚠️', 'Name required', 'Please enter an adapter name.'); return; }
  ADAPTERS_DATA.push({
    id: ADAPTERS_DATA.length + 1, name, icon: '🔌', category: cat,
    version: ver, status: 'beta', hooks: ['onConnect','onSync','onError'],
    downloads: 0, endpoints: 0, color: '#6366f1'
  });
  closeModal('addAdapterModal');
  renderAdapters();
  addLog('SUCCESS', `New adapter registered: <span class="log-bold">${name} ${ver}</span>`);
  showToast('success', '✅', 'Adapter registered', `${name} added to the registry.`);
  ['newAdapterName','newAdapterVersion','newAdapterUrl'].forEach(id => document.getElementById(id).value = '');
}

function configureAdapter() {
  if (!STATE.selectedAdapter) return;
  closeModal('adapterModal');
  switchModule('autoconfig');
  showToast('info', '⚙️', 'Adapter loaded', `${STATE.selectedAdapter.name} ready for configuration.`);
}

/* ── Auto-Configuration ── */
const FIELD_MAPPINGS = {
  'salesforce-stripe': [
    { src: 'Contact.Email', tgt: 'customer.email', transform: 'direct', conf: 98 },
    { src: 'Contact.FirstName', tgt: 'customer.name', transform: 'concat(First,Last)', conf: 87 },
    { src: 'Account.BillingPhone', tgt: 'customer.phone', transform: 'e164_format', conf: 92 },
    { src: 'Opportunity.Amount', tgt: 'charge.amount', transform: 'multiply(100)', conf: 95 },
    { src: 'Contact.MailingCountry', tgt: 'customer.address.country', transform: 'ISO_3166', conf: 89 },
  ],
  'hubspot-aws-s3': [
    { src: 'contacts.email', tgt: 'Key', transform: 'hash_md5', conf: 82 },
    { src: 'deals.dealname', tgt: 'Metadata.title', transform: 'slug_encode', conf: 91 },
    { src: 'contacts.createdate', tgt: 'Metadata.created_at', transform: 'toISO8601', conf: 96 },
  ],
  'default': [
    { src: 'id', tgt: 'external_id', transform: 'direct', conf: 98 },
    { src: 'email', tgt: 'user.email', transform: 'lowercase', conf: 94 },
    { src: 'name', tgt: 'display_name', transform: 'trim', conf: 91 },
    { src: 'created_at', tgt: 'timestamp', transform: 'toISO8601', conf: 88 },
    { src: 'status', tgt: 'active', transform: 'to_boolean', conf: 85 },
    { src: 'phone', tgt: 'contact.phone', transform: 'e164_format', conf: 79 },
  ]
};

function generateConfig() {
  const src = document.getElementById('sourceSystem').value;
  const tgt = document.getElementById('targetSystem').value;
  const pattern = document.getElementById('integrationPattern').value;
  const auth = document.getElementById('authMethod').value;

  if (!src || !tgt) { showToast('warn', '⚠️', 'Select systems', 'Choose both source and target systems.'); return; }
  if (src === tgt) { showToast('warn', '⚠️', 'Invalid selection', 'Source and target must be different.'); return; }

  const btn = document.getElementById('generateConfigBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  setTimeout(() => {
    STATE.generatedConfig = { src, tgt, pattern, auth };
    const key = `${src}-${tgt}`;
    const mappings = FIELD_MAPPINGS[key] || FIELD_MAPPINGS.default;

    // Render field mappings
    const tbody = document.getElementById('mappingTableBody');
    tbody.innerHTML = mappings.map(m => `
      <tr>
        <td><span class="field-name">${m.src}</span></td>
        <td style="color:var(--text-muted);text-align:center;">→</td>
        <td><span class="field-target">${m.tgt}</span></td>
        <td><span class="transform-badge">${m.transform}</span></td>
        <td>
          <div class="confidence-bar">
            <div class="conf-bar-inner"><div class="conf-bar-fill" style="width:${m.conf}%"></div></div>
            <span class="conf-pct">${m.conf}%</span>
          </div>
        </td>
        <td><button class="btn-sm" onclick="acceptMapping(this)">✓ Accept</button></td>
      </tr>`).join('');

    const avgConf = Math.round(mappings.reduce((a,m)=>a+m.conf,0)/mappings.length);
    document.getElementById('mappingConfidence').textContent = `AI: ${avgConf}% confident`;
    document.getElementById('fieldMappingCard').style.display = 'block';

    // Generated config
    const format = document.getElementById('configFormat').value;
    const fmt = { yaml: CONFIGS.yaml, json: CONFIGS.json, env: CONFIGS.env };
    document.getElementById('configCode').textContent = (fmt[format] || CONFIGS.yaml)(src, tgt, pattern, auth);

    // Diff view
    document.getElementById('diffView').innerHTML = renderDiff(src, tgt);

    document.getElementById('configOutputArea').style.display = 'grid';

    btn.disabled = false;
    btn.innerHTML = '<span>⚡</span> Re-generate Configuration';
    addLog('SUCCESS', `Config generated: <span class="log-bold">${src} → ${tgt}</span> (${pattern})`);
    showToast('success', '✅', 'Config generated', `${mappings.length} field mappings suggested.`);
  }, 1400);
}

function renderDiff(src, tgt) {
  const lines = [
    { t: 'removed', text: `- auth.method: "api_key"` },
    { t: 'added', text: `+ auth.method: "oauth2"` },
    { t: 'same', text: `  source.adapter: "${src}"` },
    { t: 'removed', text: `- timeout_ms: 3000` },
    { t: 'added', text: `+ timeout_ms: 5000` },
    { t: 'changed', text: `~ retry.max_attempts: 2 → 3` },
    { t: 'same', text: `  target.adapter: "${tgt}"` },
    { t: 'added', text: `+ monitoring.alert_on_failure: true` },
    { t: 'same', text: `  transforms: [field_mapping, validation]` },
  ];
  const colors = { removed: 'var(--rose)', added: 'var(--emerald)', changed: 'var(--yellow)', same: 'var(--text-muted)' };
  return lines.map(l => `<span style="color:${colors[l.t]}">${l.text}</span>`).join('\n');
}

function acceptMapping(btn) {
  btn.textContent = '✓ Accepted';
  btn.style.background = 'rgba(16,185,129,0.15)';
  btn.style.borderColor = 'rgba(16,185,129,0.4)';
  btn.style.color = 'var(--emerald)';
  btn.disabled = true;
}

function switchConfigFormat() {
  const cfg = STATE.generatedConfig;
  if (!cfg) return;
  const format = document.getElementById('configFormat').value;
  const fn = CONFIGS[format] || CONFIGS.yaml;
  document.getElementById('configCode').textContent = fn(cfg.src, cfg.tgt, cfg.pattern, cfg.auth);
}

function copyConfig() {
  const text = document.getElementById('configCode').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('success', '📋', 'Copied!', 'Config copied to clipboard.'));
}

function downloadConfig() {
  const cfg = STATE.generatedConfig;
  const fmt = document.getElementById('configFormat').value;
  const text = document.getElementById('configCode').textContent;
  const ext = { yaml: '.yaml', json: '.json', env: '.env' }[fmt] || '.yaml';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = `eiop-config${ext}`;
  a.click();
  showToast('success', '⬇️', 'Downloaded', `Configuration saved as eiop-config${ext}`);
}

/* ── Simulation ── */
const SIM_RESPONSES = {
  happy: {
    salesforce: { status: 201, body: { id: 'SF-CONT-00391283', success: true, created: true }, time: 142, size: '248 B' },
    stripe: { status: 200, body: { id: 'ch_3PkK2xLkdIwHu9jY', object: 'charge', amount: 5999, currency: 'usd', status: 'succeeded' }, time: 287, size: '512 B' },
    'aws-s3': { status: 200, body: { ETag: '"d41d8cd98f00b204e980"', Location: 'https://bucket.s3.amazonaws.com/key', key: 'files/doc.pdf' }, time: 321, size: '198 B' },
    twilio: { status: 201, body: { sid: 'SM7b2b7f23c80041e2b08bb3f28543b9c6', status: 'queued', to: '+15551234567' }, time: 189, size: '312 B' },
  },
  timeout: { status: 504, body: { error: 'Gateway Timeout', message: 'Upstream service did not respond within 5000ms', retry_after: 30 }, time: 5001, size: '96 B' },
  error: { status: 500, body: { error: 'Internal Server Error', code: 'INTEGRATION_FAULT', trace_id: 'trc_abc123' }, time: 78, size: '128 B' },
  partial: { status: 207, body: { status: 'partial', succeeded: 3, failed: 1, errors: [{ id: 'rec_4', reason: 'Validation failed: email format invalid' }] }, time: 431, size: '392 B' },
  ratelimit: { status: 429, body: { error: 'Too Many Requests', retry_after: 60, limit: 100, remaining: 0 }, time: 44, size: '112 B' },
};

const SIM_ADAPTER_CONFIG = {
  salesforce: { method: 'POST', endpoint: '/v44/sobjects/Contact', reqBody: '{\n  "FirstName": "Jane",\n  "LastName": "Doe",\n  "Email": "jane.doe@example.com"\n}' },
  stripe: { method: 'POST', endpoint: '/v1/charges', reqBody: '{\n  "amount": 5999,\n  "currency": "usd",\n  "customer": "cus_Pm4sj2Ux9m"\n}' },
  'aws-s3': { method: 'PUT', endpoint: '/bucket/files/doc.pdf', reqBody: '{\n  "ContentType": "application/pdf",\n  "ContentLength": 204800\n}' },
  twilio: { method: 'POST', endpoint: '/v1/Messages', reqBody: '{\n  "To": "+15551234567",\n  "From": "+18005551000",\n  "Body": "Your order #4521 has shipped!"\n}' },
};

document.getElementById('simAdapter').addEventListener('change', function () {
  const cfg = SIM_ADAPTER_CONFIG[this.value];
  if (cfg) {
    document.getElementById('simMethod').textContent = cfg.method;
    document.getElementById('simEndpoint').textContent = cfg.endpoint;
    document.getElementById('simRequestBody').textContent = cfg.reqBody;
    document.getElementById('reqId').textContent = 'req_' + Math.random().toString(36).slice(2, 11);
  }
});

function runSimulation() {
  const adapter = document.getElementById('simAdapter').value;
  const scenario = document.getElementById('simScenario').value;
  if (!adapter) { showToast('warn', '⚠️', 'Select adapter', 'Choose an adapter to simulate.'); return; }

  const btn = document.getElementById('runSimBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Running...';
  document.getElementById('responseStatus').textContent = '⏳ Pending...';
  document.getElementById('responseMeta').style.display = 'none';

  addLog('INFO', `Simulation started: <span class="log-bold">${adapter}</span> – scenario: ${scenario}`);

  const scenarioData = SIM_RESPONSES[scenario];
  const resp = scenarioData[adapter] || scenarioData;
  const delay = scenario === 'timeout' ? 1200 : 900;

  setTimeout(() => {
    const statusColors = { 2: 'var(--emerald)', 4: 'var(--yellow)', 5: 'var(--rose)' };
    const statusColor = statusColors[Math.floor(resp.status / 100)] || 'var(--text-muted)';

    document.getElementById('responseStatus').style.color = statusColor;
    document.getElementById('responseStatus').textContent = `${resp.status} ${getStatusText(resp.status)}`;
    document.getElementById('responseMeta').style.display = 'flex';
    document.getElementById('responseTime').textContent = `${resp.time}ms`;
    document.getElementById('responseSize').textContent = resp.size;
    document.getElementById('responseRetries').textContent = scenario === 'timeout' ? '3' : '0';
    document.getElementById('simResponseBody').textContent = JSON.stringify(resp.body, null, 2);

    renderTestResults(adapter, scenario, resp);
    btn.disabled = false;
    btn.textContent = '▶ Run Simulation';

    const logLevel = resp.status >= 500 ? 'ERROR' : resp.status >= 400 ? 'WARN' : 'SUCCESS';
    addLog(logLevel, `Simulation complete – status: <span class="log-bold">${resp.status}</span>, time: ${resp.time}ms`);
    showToast(resp.status < 300 ? 'success' : 'warn', resp.status < 300 ? '✅' : '⚠️', `${resp.status} Response`, `Completed in ${resp.time}ms`);
  }, delay);
}

function getStatusText(code) {
  const map = { 200:'OK',201:'Created',207:'Multi-Status',400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',429:'Too Many Requests',500:'Internal Server Error',504:'Gateway Timeout' };
  return map[code] || '';
}

function renderTestResults(adapter, scenario, resp) {
  const card = document.getElementById('testResultsCard');
  card.style.display = 'block';

  const tests = [
    { name: 'Connection established', pass: resp.status !== 504, dur: '12ms' },
    { name: 'Auth token valid', pass: resp.status !== 401 && resp.status !== 403, dur: '34ms' },
    { name: `Status code ${resp.status < 300 ? 'success' : 'expected'}`, pass: resp.status < 300, dur: `${resp.time}ms` },
    { name: 'Response schema valid', pass: resp.status < 300, dur: '8ms' },
    { name: 'Response time < 500ms', pass: resp.time < 500, dur: `${resp.time}ms`, warn: resp.time > 300 && resp.time < 500 },
    { name: 'No rate limit hit', pass: resp.status !== 429, dur: '2ms' },
  ];

  const passed = tests.filter(t => t.pass).length;
  const total = tests.length;
  const color = passed === total ? 'var(--emerald)' : passed > total/2 ? 'var(--yellow)' : 'var(--rose)';

  document.getElementById('testSummary').innerHTML = `<span style="color:${color};font-weight:800;">${passed}/${total} passed</span>`;
  document.getElementById('testCases').innerHTML = tests.map(t => {
    const cls = !t.pass ? 'fail' : t.warn ? 'warn' : 'pass';
    const icon = !t.pass ? '❌' : t.warn ? '⚠️' : '✅';
    const res = !t.pass ? 'FAILED' : t.warn ? 'WARN' : 'PASSED';
    const resCls = !t.pass ? 'result-fail' : t.warn ? 'result-warn' : 'result-pass';
    return `<div class="test-case ${cls}">
      <span class="test-icon">${icon}</span>
      <span class="test-name">${t.name}</span>
      <span class="test-result ${resCls}">${res}</span>
      <span class="test-duration">${t.dur}</span>
    </div>`;
  }).join('');
}

function runParallelTest() {
  const adapter = document.getElementById('simAdapter').value;
  if (!adapter) { showToast('warn', '⚠️', 'Select adapter', 'Choose an adapter first.'); return; }
  showToast('info', '⚡', 'Parallel test started', 'Testing v2, v3, and v4 simultaneously…');
  addLog('INFO', `Parallel version test initiated for <span class="log-bold">${adapter}</span>`);
  setTimeout(() => {
    showToast('success', '✅', 'Parallel test complete', 'v3 recommended – best score 97.2%');
    addLog('SUCCESS', `Parallel test: v3 scored highest – <span class="log-bold">97.2%</span> reliability`);
  }, 2200);
}

/* ── Rollback ── */
function rollbackTo(version) {
  STATE.rollbackTarget = version;
  document.getElementById('rollbackVersionLabel').textContent = version;
  document.getElementById('rollbackModal').style.display = 'flex';
}

function confirmRollback() {
  closeModal('rollbackModal');
  addLog('WARN', `Rollback initiated to <span class="log-bold">${STATE.rollbackTarget}</span>`);
  showToast('warn', '⏪', 'Rolling back…', `Reverting to ${STATE.rollbackTarget}`);
  setTimeout(() => {
    showToast('success', '✅', 'Rollback complete', `Now running ${STATE.rollbackTarget}`);
    addLog('SUCCESS', `Rollback to <span class="log-bold">${STATE.rollbackTarget}</span> completed successfully`);
  }, 2000);
}

/* ── Audit Logs ── */
const ALL_LOGS = [];

function addLog(level, msg) {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  ALL_LOGS.unshift({ level, msg, time });
  if (STATE.currentModule === 'logs') renderLogs();
}

function renderLogs() {
  const filter = document.getElementById('logLevelFilter')?.value || '';
  const terminal = document.getElementById('logTerminal');
  if (!terminal) return;

  const filtered = filter ? ALL_LOGS.filter(l => l.level === filter) : ALL_LOGS;

  if (filtered.length === 0) {
    terminal.innerHTML = '<span style="color:var(--text-muted)">No log entries to display.</span>';
    return;
  }

  terminal.innerHTML = filtered.map(l => `
    <div class="log-line">
      <span class="log-time">${l.time}</span>
      <span class="log-level ${l.level}">${l.level}</span>
      <span class="log-msg">${l.msg}</span>
    </div>`).join('');
}

function filterLogs() { renderLogs(); }
function clearLogs() { ALL_LOGS.length = 0; renderLogs(); showToast('info', '🗑', 'Logs cleared', 'Audit log has been cleared.'); }

/* ── Modals ── */
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
});

/* ── Toast Notifications ── */
function showToast(type, icon, title, msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><div class="toast-msg"><strong>${title}</strong><br>${msg}</div>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 4000);
}

/* ── Global Search ── */
document.getElementById('globalSearch').addEventListener('input', function () {
  const val = this.value.trim().toLowerCase();
  if (!val) return;
  if (['parser','parse','brd','doc','requirement'].some(k => val.includes(k))) switchModule('parser');
  else if (['adapter','registry','hook','catalog'].some(k => val.includes(k))) switchModule('registry');
  else if (['config','mapping','transform'].some(k => val.includes(k))) switchModule('autoconfig');
  else if (['sim','test','mock','rollback'].some(k => val.includes(k))) switchModule('simulation');
});

/* ── Init ── */
window.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  addLog('INFO', 'EIOP Platform version <span class="log-bold">2.4.0</span> initialized');
  addLog('INFO', 'Adapter registry loaded – <span class="log-bold">12 adapters</span> available');
  addLog('SUCCESS', 'NLP engine ready – model loaded in 342ms');

  // Auto-animate pipeline after delay
  setTimeout(() => {
    const step3 = document.querySelector('.pipe-step[data-step="3"]');
    const step4 = document.querySelector('.pipe-step[data-step="4"]');
    if (step3 && step4) {
      step3.classList.remove('active'); step3.classList.add('done');
      step3.querySelector('.pipe-status').textContent = 'Done';
      step4.classList.remove('pending'); step4.classList.add('active');
      step4.querySelector('.pipe-status').textContent = 'Running';
    }
  }, 4000);
});
