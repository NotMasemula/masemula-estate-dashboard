document.addEventListener('DOMContentLoaded', async () => {
  // Load config (public-only settings)
  let config = {};
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (res.ok) config = await res.json();
  } catch (e) {
    console.warn('Could not load config.json');
  }

  const workflowGrid = document.getElementById('workflowGrid');
  const responseEl = document.getElementById('workflowResponse');
  const dashboardGrid = document.getElementById('dashboardStateGrid');
  const DEFAULT_DISPATCH_URL = 'https://romytadgdnpphqzlseaa.supabase.co/functions/v1/dispatch-workflow';

  const registry = [
    { id: 'routine', name: 'Routine Sync', ui_actions: ['routine-card'] },
    { id: 'ventures', name: 'Ventures Sync', ui_actions: ['ventures-card'] },
    { id: 'academics', name: 'Academics Sync', ui_actions: ['academics-card'] },
    { id: 'finance', name: 'Finance Sync', ui_actions: ['finance-card'] },
    { id: 'headspace', name: 'Headspace Sync', ui_actions: ['headspace-card'] },
    { id: 'goals', name: 'Goals Sync', ui_actions: ['goals-card'] },
  ];

  // Simple in-memory store for dashboard state
  const dashboardState = {};

  function renderWorkflowButtons() {
    if (!workflowGrid) return;
    workflowGrid.innerHTML = '';
    registry.forEach(w => {
      const btn = document.createElement('button');
      btn.className = 'workflow-button';
      btn.textContent = w.name;
      btn.dataset.id = w.id;
      btn.addEventListener('click', () => runWorkflow(w.id));
      workflowGrid.appendChild(btn);
    });
  }

  function setResponse(obj) {
    if (!responseEl) return;
    const fields = {
      responseAgent: obj.agent || 'Personal Assistant',
      responseWorkflow: obj.workflow || 'unknown',
      responseStatus: obj.status || 'unknown',
      responseTimestamp: obj.timestamp || new Date().toISOString(),
      responseMessage: obj.message || '',
      responseSections: Array.isArray(obj.sections) ? obj.sections.join(', ') : (obj.sections || ''),
    };
    Object.keys(fields).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = fields[id];
    });
  }

  function mergeUpdates(updates) {
    if (!updates || typeof updates !== 'object') return;
    Object.keys(updates).forEach(k => {
      dashboardState[k] = Object.assign({}, dashboardState[k] || {}, updates[k]);
    });
    renderDashboardState();
  }

  function renderDashboardState() {
    if (!dashboardGrid) return;
    dashboardGrid.innerHTML = '';
    Object.keys(dashboardState).forEach(key => {
      const card = document.createElement('div');
      card.className = 'state-card';
      const title = document.createElement('div');
      title.className = 'state-title';
      title.textContent = key;
      const body = document.createElement('pre');
      body.className = 'state-body';
      body.textContent = JSON.stringify(dashboardState[key], null, 2);
      card.appendChild(title);
      card.appendChild(body);
      dashboardGrid.appendChild(card);
    });
  }

  function simulateResponse(workflowId) {
    return {
      agent: 'Personal Assistant',
      workflow: workflowId,
      status: 'completed',
      timestamp: new Date().toISOString(),
      message: 'Simulation: workflow run completed locally.',
      sections: [workflowId],
      updates: {
        [workflowId]: { summary: `Simulated update for ${workflowId}`, updated_at: new Date().toISOString() }
      },
      ui_actions: ['refresh_cards']
    };
  }

  async function loadConfig() {
    try {
      const res = await fetch('config.json', { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function runWorkflow(workflowId) {
    setResponse({ agent: 'Personal Assistant', workflow: workflowId, status: 'running', timestamp: new Date().toISOString(), message: 'Dispatching...' });

    const cfg = await loadConfig();
    const dispatchUrl = cfg?.dispatchUrl || DEFAULT_DISPATCH_URL;
    const dispatchHeaderName = cfg?.dispatchSecretHeader || 'x-dispatch-secret';
    const dispatchSecret = cfg?.dispatchSecret || null; // optional, public sites should only use non-sensitive headers

    if (!dispatchUrl) {
      // No dispatch configured — fallback to simulation
      await new Promise(r => setTimeout(r, 400));
      const response = simulateResponse(workflowId);
      setResponse(response);
      mergeUpdates(response.updates);
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (dispatchSecret) headers[dispatchHeaderName] = dispatchSecret;

      const res = await fetch(dispatchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workflowId,
          user_id: 'masemula-dashboard',
          source: 'dashboard',
        }),
      });
      if (!res.ok) throw new Error(`Dispatch failed: ${res.status}`);
      const json = await res.json();
      setResponse(json);
      if (json.updates) mergeUpdates(json.updates);
    } catch (err) {
      // fallback to simulation
      const response = simulateResponse(workflowId);
      response.status = 'failed';
      response.message = `Dispatch failed, using simulation (${String(err)})`;
      setResponse(response);
      mergeUpdates(response.updates);
    }
  }

  renderWorkflowButtons();
  // Don't load dashboard state on init — only render when workflows update it
});

// Expose helpers for debugging in console
window._masemulaDashboard = {
  runWorkflow: (id) => document.querySelector(`[data-id="${id}"]`)?.click(),
};
