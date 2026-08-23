document.getElementById('year').textContent = new Date().getFullYear();

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    const isHidden = mobileMenu.classList.toggle('hidden');
    mobileMenuBtn.setAttribute('aria-expanded', String(!isHidden));
  });
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
      <span class="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full"><i class="fa-solid fa-layer-group"></i> ${RBP.escapeHtml(v.department || '—')}</span>
    </div>
    <div class="flex items-center justify-between pt-4 border-t border-gray-100">
      <span class="text-teal font-semibold text-sm">${RBP.escapeHtml(v.salary_range || 'Negotiable')}</span>
      <span class="text-navy font-semibold text-sm inline-flex items-center gap-1">View <i class="fa-solid fa-arrow-right text-xs"></i></span>
    </div>
  </a>`;
}

async function loadHomeData() {
  try {
    const openVacancies = await RbpApi.getVacancies();
    document.getElementById('statVacancies').textContent = openVacancies.length;

    let featured = openVacancies.filter(v => v.is_featured);
    if (featured.length < 3) {
      const rest = openVacancies.filter(v => !v.is_featured);
      featured = featured.concat(rest).slice(0, 3);
    } else {
      featured = featured.slice(0, 3);
    }

    const featuredList = document.getElementById('featuredList');
    if (featured.length === 0) {
      featuredList.innerHTML = `<div class="col-span-full text-center py-12 text-navy/50">
        <i class="fa-solid fa-inbox text-3xl mb-3"></i>
        <p class="mb-4">There are currently no advertised vacancies. You can still register your interest with Remote Business Partner.</p>
        <a href="for-candidates.html#register-interest" class="inline-flex items-center gap-2 bg-teal hover:bg-teal/90 text-white font-semibold px-6 py-2.5 rounded-full transition">
          <i class="fa-solid fa-envelope"></i> Register Your Interest
        </a>
      </div>`;
    } else {
      featuredList.innerHTML = featured.map(vacancyCard).join('');
    }
  } catch (err) {
    console.error(err);
    document.getElementById('featuredList').innerHTML = `<div class="col-span-full text-center py-12 text-red-500">
      <i class="fa-solid fa-triangle-exclamation text-2xl mb-3"></i>
      <p>We couldn't load current vacancies. Please try again shortly.</p>
    </div>`;
  }
}

loadHomeData();
