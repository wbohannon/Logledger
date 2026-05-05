const axios = require('axios');

const getAuthHeader = () => {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) throw new Error('JIRA_EMAIL and JIRA_API_TOKEN must be set');
  const encoded = Buffer.from(`${email}:${token}`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
};

const getBaseUrl = () => {
  const base = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  if (!base) throw new Error('JIRA_BASE_URL must be set');
  return base;
};

/**
 * Jira custom field id for "time exported[dropdown]". Set via JIRA_DOWNTIME_EXPORTED_FIELD_ID.
 * Used when marking issues as exported after invoice generation.
 */
const getTimeExportedFieldId = () => process.env.JIRA_DOWNTIME_EXPORTED_FIELD_ID || '';
const getEpicLinkFieldId = () => process.env.JIRA_EPIC_LINK_FIELD_ID || '';

/**
 * Fetch issues in project matching: time exported = No, status != BackLog, timespent > 0.
 * Returns all matching issues with all their worklogs (no date filter).
 * Uses /rest/api/3/search/jql (legacy /search returns 410 Gone).
 */
async function fetchIssuesWithWorklogs(projectKey) {
  const baseUrl = getBaseUrl();
  const jql = `project = "${projectKey}" AND "time exported[dropdown]" = "No" AND status != "BackLog" AND timespent > 0 ORDER BY created DESC`;
  const searchUrl = `${baseUrl}/rest/api/3/search/jql`;
  const params = { jql, maxResults: 100 };
  const { data } = await axios.get(searchUrl, {
    headers: { ...getAuthHeader(), Accept: 'application/json' },
    params,
  });
  const issues = [];
  const rawIssues = data?.values ?? data?.issues ?? [];
  for (const issue of rawIssues) {
    const idOrKey = issue.key ?? issue.id;
    if (idOrKey == null) continue;
    const worklogs = await fetchWorklogs(idOrKey);
    if (worklogs.length === 0) continue;
    const info = await fetchIssueDetails(idOrKey);
    issues.push({
      key: info.key ?? String(idOrKey),
      summary: info.summary ?? info.key ?? String(idOrKey),
      epicTitle: info.epicTitle ?? 'General Maintenance',
      worklogs,
    });
  }
  return issues;
}

/**
 * Resolve epic title by walking up the parent chain until we find an Epic or reach the top.
 * Handles: Epic → child tasks (parent = Epic) and Epic → Story → Subtask (parent chain to Epic).
 */
async function resolveEpicTitleFromParent(baseUrl, parentKey) {
  const seen = new Set();
  let key = parentKey;
  let summary = null;
  while (key && !seen.has(key)) {
    seen.add(key);
    try {
      const res = await axios.get(`${baseUrl}/rest/api/3/issue/${key}`, {
        headers: { ...getAuthHeader(), Accept: 'application/json' },
        params: { fields: ['summary', 'parent', 'issuetype'] },
      });
      const d = res.data;
      summary = d.fields?.summary ?? key;
      const typeName = d.fields?.issuetype?.name ?? '';
      if (/epic/i.test(typeName)) return summary;
      const nextParent = d.fields?.parent?.key;
      if (!nextParent) break;
      key = nextParent;
    } catch (_) {
      break;
    }
  }
  return summary;
}

/**
 * Fetch issue key, summary, and epic title by issue id or key.
 * Epic title: (1) walk up parent chain to an Epic, or (2) Epic Link field when JIRA_EPIC_LINK_FIELD_ID is set.
 * Supports Epic → child tasks and Epic → Story → Subtask.
 */
async function fetchIssueDetails(idOrKey) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/issue/${idOrKey}`;
  const fields = ['summary', 'parent', 'issuetype'];
  const epicLinkFieldId = getEpicLinkFieldId();
  if (epicLinkFieldId) fields.push(epicLinkFieldId);
  const params = { fields };
  const { data } = await axios.get(url, {
    headers: { ...getAuthHeader(), Accept: 'application/json' },
    params,
  });
  let epicTitle = null;
  const parent = data.fields?.parent;
  if (parent?.key) {
    epicTitle = await resolveEpicTitleFromParent(baseUrl, parent.key);
  }
  if (!epicTitle && epicLinkFieldId && data.fields?.[epicLinkFieldId]) {
    const epicRef = data.fields[epicLinkFieldId];
    const epicKey = typeof epicRef === 'string' ? epicRef : epicRef?.key ?? epicRef?.value;
    if (epicKey) {
      try {
        const epicRes = await axios.get(`${baseUrl}/rest/api/3/issue/${epicKey}`, {
          headers: { ...getAuthHeader(), Accept: 'application/json' },
          params: { fields: ['summary'] },
        });
        epicTitle = epicRes.data.fields?.summary ?? epicKey;
      } catch (_) {}
    }
  }
  return {
    key: data.key,
    summary: data.fields?.summary ?? data.key,
    epicTitle,
  };
}

/**
 * Fetch all worklogs for an issue.
 */
async function fetchWorklogs(issueKey) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/issue/${issueKey}/worklog`;
  const { data } = await axios.get(url, {
    headers: { ...getAuthHeader(), Accept: 'application/json' },
  });
  return (data.worklogs || []).map((w) => ({
    timeSpentSeconds: w.timeSpentSeconds || 0,
    description: w.comment?.plain || w.comment?.content?.map((c) => c.text).join(' ') || '',
    started: w.started,
  }));
}

/**
 * Convert seconds to decimal hours.
 */
function secondsToDecimalHours(seconds) {
  return Math.round((seconds / 3600) * 100) / 100;
}

/**
 * Mark issue as exported by setting "time exported[dropdown]" to "Yes".
 */
async function markIssueExported(issueKey) {
  const fieldId = getTimeExportedFieldId();
  if (!fieldId) {
    console.warn('JIRA_DOWNTIME_EXPORTED_FIELD_ID not set; skipping Jira field update for', issueKey);
    return;
  }
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/rest/api/3/issue/${issueKey}`;
  await axios.put(
    url,
    { fields: { [fieldId]: { value: 'Yes' } } },
    { headers: { ...getAuthHeader(), 'Content-Type': 'application/json', Accept: 'application/json' } }
  );
}

/**
 * Format worklog for display: date + optional description.
 */
function formatWorklogDescription(w) {
  const dateStr = w.started
    ? new Date(w.started).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const desc = (w.description || '').trim();
  return dateStr ? (desc ? `${dateStr} — ${desc}` : dateStr) : desc || null;
}

/**
 * Aggregate worklogs into line items: one line per worklog (itemized) with issue key and summary.
 */
function aggregateWorklogsForInvoice(issuesWithWorklogs, hourlyRate) {
  const lineItems = [];
  for (const issue of issuesWithWorklogs) {
    for (const w of issue.worklogs) {
      const hours = secondsToDecimalHours(w.timeSpentSeconds || 0);
      if (hours <= 0) continue;
      const amount = Math.round(hours * hourlyRate * 100) / 100;
      lineItems.push({
        epicTitle: issue.epicTitle ?? 'General Maintenance',
        issueKey: issue.key,
        summary: issue.summary,
        worklogDescription: formatWorklogDescription(w),
        hours,
        rate: hourlyRate,
        amount,
      });
    }
  }
  return lineItems;
}

module.exports = {
  fetchIssuesWithWorklogs,
  fetchWorklogs,
  secondsToDecimalHours,
  markIssueExported,
  aggregateWorklogsForInvoice,
  getBaseUrl,
};
