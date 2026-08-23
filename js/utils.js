/* ===========================================================
   Shared UI/formatting utilities (no network calls).

   All network access lives in js/api.js (RbpApi), which talks exclusively
   to same-origin Cloudflare Pages Functions under /api/*. This file
   intentionally contains no fetch() calls and no reference to the
   GenSpark Table API — see PRELAUNCH_BLOCKERS.md and
   scripts/prelaunch-check.mjs.
   =========================================================== */

const RBP = (() => {

  // ---------- Toast ----------
  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  // ---------- Formatting ----------
  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function timeAgo(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    return `${Math.floor(months / 12)} year(s) ago`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function nl2br(str) {
    if (!str) return '';
    return escapeHtml(str).replace(/\n/g, '<br>');
  }

  function badgeClass(status) {
    const map = {
      'Open': 'badge-open', 'Closed': 'badge-closed', 'Draft': 'badge-draft',
      'Applied': 'badge-new', 'Screening': 'badge-review', 'Shortlisted': 'badge-shortlisted',
      'Interview': 'badge-interview', 'Offer': 'badge-offer', 'Hired': 'badge-accepted',
      'Rejected': 'badge-rejected', 'Withdrawn': 'badge-withdrawn',
      'New': 'badge-new', 'Contacted': 'badge-review', 'Engaged': 'badge-interview', 'Archived': 'badge-withdrawn'
    };
    return map[status] || 'badge-draft';
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  return {
    toast, formatDate, timeAgo, escapeHtml, nl2br, badgeClass, qs
  };
})();
