document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
  const isHidden = mobileMenu.classList.toggle('hidden');
  mobileMenuBtn.setAttribute('aria-expanded', String(!isHidden));
});

let BASELINE_VACANCIES = [];

function populateFilterOptions() {
  const locations = [...new Set(BASELINE_VACANCIES.map(v => v.location).filter(Boolean))].sort();
  const types = [...new Set(BASELINE_VACANCIES.map(v => v.job_type).filter(Boolean))].sort();

  const locSel = document.getElementById('filterLocation');
  const typeSel = document.getElementById('filterType');

  locSel.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  typeSel.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());

  locations.forEach(l => locSel.insertAdjacentHTML('beforeend', `<option value="${RBP.escapeHtml(l)}">${RBP.escapeHtml(l)}</option>`));
  types.forEach(t => typeSel.insertAdjacentHTML('beforeend', `<option value="${RBP.escapeHtml(t)}">${RBP.escapeHtml(t)}</option>`));
}

function vacancyCard(v) {
  const desc = (v.summary || v.description || '').replace(/<[^>]*>/g, '');
  return `
  <a href="vacancy.html?id=${encodeURIComponent(v.id)}" class="vacancy-card block bg-white rounded-2xl border border-gray-100 p-6">
    <div class="flex items-start justify-between mb-3">
      <span class="badge badge-open">Open</span>
      ${v.is_featured ? '<span class="text-gold"><i class="fa-solid fa-star"></i></span>' : ''}
    </div>
    <h3 class="font-display font-bold text-lg mb-2">${RBP.escapeHtml(v.title)}</h3>
    <p class="text-sm text-navy/60 line-clamp-2 mb-4">${RBP.escapeHtml(desc)}</p>
    <div class="flex flex-wrap gap-2 text-xs text-navy/60 mb-4">
      <span class="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full"><i class="fa-solid fa-briefcase"></i> ${RBP.escapeHtml(v.job_type || '—')}</span>
      <span class="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full"><i class="fa-solid fa-location-dot"></i> ${RBP.escapeHtml(v.location || '—')}</span>
    </div>
    <div class="flex items-center justify-between pt-4 border-t border-gray-100">
      <span class="text-teal font-semibold text-sm">${RBP.escapeHtml(v.salary_range || 'Negotiable')}</span>
      <span class="text-navy font-semibold text-sm inline-flex items-center gap-1">View <i class="fa-solid fa-arrow-right text-xs"></i></span>
    </div>
  </a>`;
}

function renderList(vacancies) {
  const sorted = vacancies.slice().sort((a, b) => {
    if (!!b.is_featured - !!a.is_featured !== 0) return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0);
    return new Date(b.posted_at || 0) - new Date(a.posted_at || 0);
  });

  const list = document.getElementById('vacancyList');
  const countEl = document.getElementById('resultCount');
  countEl.textContent = `${sorted.length} current vacanc${sorted.length === 1 ? 'y' : 'ies'} found`;

  if (sorted.length === 0) {
    const noneAtAll = BASELINE_VACANCIES.length === 0;
    if (noneAtAll) {
      list.innerHTML = `<div class="col-span-full text-center py-16 text-navy/50">
        <i class="fa-solid fa-inbox text-3xl mb-3"></i>
        <p class="mb-4">There are currently no advertised vacancies. You can still register your interest with Remote Business Partner.</p>
        <a href="for-candidates.html#register-interest" class="inline-flex items-center gap-2 bg-teal hover:bg-teal/90 text-white font-semibold px-6 py-2.5 rounded-full transition">
          <i class="fa-solid fa-envelope"></i> Register Your Interest
        </a>
      </div>`;
    } else {
      list.innerHTML = `<div class="col-span-full text-center py-16 text-navy/50">
        <i class="fa-solid fa-magnifying-glass text-3xl mb-3"></i><p>No vacancies match your filters. Try adjusting your search.</p>
      </div>`;
    }
    return;
  }
  list.innerHTML = sorted.map(vacancyCard).join('');
}

async function applyFilters() {
  const q = document.getElementById('searchInput').value.trim();
  const location = document.getElementById('filterLocation').value;
  const job_type = document.getElementById('filterType').value;

  try {
    const filtered = await RbpApi.getVacancies({ q, location, job_type });
    renderList(filtered);
  } catch (err) {
    console.error(err);
    document.getElementById('resultCount').textContent = '';
    document.getElementById('vacancyList').innerHTML = `<div class="col-span-full text-center py-16 text-red-500">
      <i class="fa-solid fa-triangle-exclamation text-3xl mb-3"></i>
      <p>We couldn't load current vacancies. Please try again shortly.</p>
    </div>`;
  }
}

async function loadVacancies() {
  try {
    BASELINE_VACANCIES = await RbpApi.getVacancies();
    populateFilterOptions();
    renderList(BASELINE_VACANCIES);
  } catch (err) {
    console.error(err);
    document.getElementById('resultCount').textContent = '';
    document.getElementById('vacancyList').innerHTML = `<div class="col-span-full text-center py-16 text-red-500">
      <i class="fa-solid fa-triangle-exclamation text-3xl mb-3"></i>
      <p>We couldn't load current vacancies. Please try again shortly.</p>
    </div>`;
  }
}

document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('filterLocation').addEventListener('change', applyFilters);
document.getElementById('filterType').addEventListener('change', applyFilters);
document.getElementById('resetFilters').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterLocation').value = '';
  document.getElementById('filterType').value = '';
  renderList(BASELINE_VACANCIES);
});

loadVacancies();
