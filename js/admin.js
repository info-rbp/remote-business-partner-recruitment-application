/* RBP Recruitment Administration
   UI access is gated by Firebase Auth + /api/admin/session. The real security
   boundary remains functions/api/admin/_middleware.js on every staff API. */

let vacancies = [], applications = [], requests = [], interest = [];
const APP_STATUSES = ['Applied','Screening','Shortlisted','Interview','Offer','Hired','Rejected','Withdrawn'];
const REQUEST_STATUSES = ['New','Contacted','Engaged','Closed'];
const INTEREST_STATUSES = ['New','Contacted','Archived'];
let applicationPage = 1;
const PAGE_SIZE = 25;
let pendingConfirm = null;

const $ = id => document.getElementById(id);

function deny(message) {
  $('authLoading').classList.add('hidden');
  $('authDeniedMessage').textContent = message;
  $('authDenied').classList.remove('hidden');
}

async function fetchAllPaged(loader) {
  const first = await loader({ page: 1, limit: 100 });
  let rows = first.data || [];
  const pages = first.pagination ? first.pagination.pages : 1;
  for (let p = 2; p <= pages; p++) {
    const next = await loader({ page: p, limit: 100 });
    rows = rows.concat(next.data || []);
  }
  return rows;
}

async function loadAll() {
  try {
    const [v, a, r, i] = await Promise.all([
      RbpApi.adminGetVacancies(),
      fetchAllPaged(p => RbpApi.adminGetApplications(p)),
      fetchAllPaged(p => RbpApi.adminGetRecruitmentRequests(p)),
      fetchAllPaged(p => RbpApi.adminGetCandidateInterest(p))
    ]);
    vacancies = v || [];
    applications = a || [];
    requests = r || [];
    interest = i || [];
    renderAll();
  } catch (err) {
    console.error(err);
    if (err.status === 401 || err.status === 403) {
      await RbpApi.signOutStaff();
      location.href = 'login.html';
      return;
    }
    RBP.toast('Dashboard data could not be loaded. Please refresh and try again.', 'error');
  }
}

function renderAll() {
  renderOverview();
  renderVacancies();
  populateApplicationVacancyFilter();
  renderApplications();
  renderRequests();
  renderInterest();
}

function switchTab(tab) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.admin-tab').forEach(b => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('bg-navy', active); b.classList.toggle('text-white', active);
    b.classList.toggle('bg-white', !active); b.classList.toggle('border', !active); b.classList.toggle('border-gray-200', !active);
  });
  const panel = $(`tab-${tab}`); if (panel) panel.classList.remove('hidden');
  history.replaceState(null, '', `#${tab}`);
}

document.querySelectorAll('.admin-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

function renderOverview() {
  $('ovTotalVacancies').textContent = vacancies.length;
  $('ovOpenVacancies').textContent = vacancies.filter(v => v.status === 'Open').length;
  $('ovTotalApplications').textContent = applications.length;
  $('ovNewApplications').textContent = applications.filter(a => ['Applied','Screening','Shortlisted'].includes(a.status)).length;
  $('ovInterviews').textContent = applications.filter(a => a.status === 'Interview').length;
  $('ovHires').textContent = applications.filter(a => a.status === 'Hired').length;
  $('ovNewRequests').textContent = requests.filter(r => r.status === 'New').length;
  const titles = Object.fromEntries(vacancies.map(v => [v.id, v.title]));
  const recent = applications.slice().sort((a,b) => new Date(b.applied_at) - new Date(a.applied_at)).slice(0,6);
  $('ovRecentApplications').innerHTML = recent.length ? recent.map(a => `<div class="flex justify-between gap-4 border-b last:border-0 pb-3"><div class="min-w-0"><p class="font-medium text-sm truncate">${RBP.escapeHtml(a.candidate_name)}</p><p class="text-xs text-navy/50 truncate">${RBP.escapeHtml(titles[a.vacancy_id] || 'Unknown vacancy')} · ${RBP.formatDate(a.applied_at)}</p></div><span class="badge ${RBP.badgeClass(a.status)}">${RBP.escapeHtml(a.status)}</span></div>`).join('') : '<p class="text-sm text-navy/40">No applications have been received yet.</p>';
}

function vacancyPayload() {
  return {
    title: $('fTitle').value.trim(), employer_name: $('fEmployerName').value.trim(), department: $('fDepartment').value.trim(),
    location: $('fLocation').value.trim(), job_type: $('fJobType').value, experience_level: $('fExperienceLevel').value.trim(),
    salary_range: $('fSalaryRange').value.trim(), deadline_date: $('fDeadline').value || null, summary: $('fSummary').value.trim(),
    description: $('fDescription').value.trim(), responsibilities: $('fResponsibilities').value.trim(), requirements: $('fRequirements').value.trim(),
    benefits: $('fBenefits').value.trim(), status: $('fStatus').value, is_featured: $('fFeatured').checked
  };
}

function resetVacancyForm() {
  $('vacancyForm').reset(); $('editVacancyId').value = ''; $('fStatus').value = 'Draft';
  $('vacancyFormTitle').textContent = 'Post a New Vacancy'; $('vacancySubmitBtn').innerHTML = '<i class="fa-solid fa-check mr-1"></i> Save Vacancy';
  $('vacancyCancelEditBtn').classList.add('hidden');
}

function editVacancy(id) {
  const v = vacancies.find(x => x.id === id); if (!v) return;
  $('editVacancyId').value = v.id; $('fTitle').value = v.title || ''; $('fEmployerName').value = v.employer_name || '';
  $('fDepartment').value = v.department || ''; $('fLocation').value = v.location || ''; $('fJobType').value = v.job_type || 'Full-Time';
  $('fExperienceLevel').value = v.experience_level || ''; $('fSalaryRange').value = v.salary_range || ''; $('fDeadline').value = v.deadline_date || '';
  $('fSummary').value = v.summary || ''; $('fDescription').value = v.description || ''; $('fResponsibilities').value = v.responsibilities || '';
  $('fRequirements').value = v.requirements || ''; $('fBenefits').value = v.benefits || ''; $('fStatus').value = v.status; $('fFeatured').checked = !!v.is_featured;
  $('vacancyFormTitle').textContent = `Edit: ${v.title}`; $('vacancySubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Save Changes';
  $('vacancyCancelEditBtn').classList.remove('hidden'); switchTab('vacancies'); window.scrollTo({top:0,behavior:'smooth'});
}

$('vacancyCancelEditBtn').addEventListener('click', resetVacancyForm);
$('vacancyForm').addEventListener('submit', async e => {
  e.preventDefault(); const id = $('editVacancyId').value; const btn = $('vacancySubmitBtn'); btn.disabled = true;
  try {
    if (id) await RbpApi.adminUpdateVacancy(id, vacancyPayload()); else await RbpApi.adminCreateVacancy(vacancyPayload());
    RBP.toast(id ? 'Vacancy updated.' : 'Vacancy created.', 'success'); resetVacancyForm(); await loadAll();
  } catch (err) { console.error(err); RBP.toast(err.message || 'Vacancy could not be saved.', 'error'); }
  finally { btn.disabled = false; }
});

function renderVacancies() {
  const body = $('vacancyTableBody');
  if (!vacancies.length) { body.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-navy/40">No vacancies yet.</td></tr>'; return; }
  body.innerHTML = vacancies.map(v => `<tr class="border-b last:border-0"><td class="px-5 py-3.5"><p class="font-medium">${RBP.escapeHtml(v.title)}</p><p class="text-xs text-navy/40">${RBP.escapeHtml(v.employer_name || '')}</p></td><td class="px-5 py-3.5">${RBP.escapeHtml(v.job_type)}</td><td class="px-5 py-3.5">${RBP.escapeHtml(v.location)}</td><td class="px-5 py-3.5"><span class="badge ${RBP.badgeClass(v.status)}">${RBP.escapeHtml(v.status)}</span></td><td class="px-5 py-3.5 text-right whitespace-nowrap"><button class="edit-v text-teal mr-3" data-id="${v.id}" aria-label="Edit vacancy"><i class="fa-solid fa-pen"></i></button><button class="toggle-v text-navy/60 mr-3" data-id="${v.id}" aria-label="${v.status==='Open'?'Close':'Open'} vacancy"><i class="fa-solid ${v.status==='Open'?'fa-circle-stop':'fa-circle-play'}"></i></button><button class="delete-v text-red-500" data-id="${v.id}" aria-label="Delete vacancy"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
  body.querySelectorAll('.edit-v').forEach(b => b.onclick = () => editVacancy(b.dataset.id));
  body.querySelectorAll('.toggle-v').forEach(b => b.onclick = async () => { const v = vacancies.find(x=>x.id===b.dataset.id); try { await RbpApi.adminUpdateVacancy(v.id,{status:v.status==='Open'?'Closed':'Open'}); await loadAll(); } catch(e){ RBP.toast(e.message,'error'); } });
  body.querySelectorAll('.delete-v').forEach(b => b.onclick = () => confirmAction('Permanently delete this vacancy? Vacancies with applications cannot be deleted.', async()=>{ await RbpApi.adminDeleteVacancy(b.dataset.id); RBP.toast('Vacancy deleted.','success'); await loadAll(); }));
}

function populateApplicationVacancyFilter() {
  const select = $('appVacancyFilter'); const current = select.value;
  select.innerHTML = '<option value="">All vacancies</option>' + vacancies.map(v=>`<option value="${v.id}">${RBP.escapeHtml(v.title)}</option>`).join(''); select.value = current;
}

function filteredApplications() {
  const q = $('appSearch').value.trim().toLowerCase(), status = $('appStatusFilter').value, vacancy = $('appVacancyFilter').value;
  return applications.filter(a => (!q || `${a.candidate_name} ${a.email}`.toLowerCase().includes(q)) && (!status || a.status===status) && (!vacancy || a.vacancy_id===vacancy));
}

function renderApplications() {
  const all = filteredApplications(); const pages = Math.max(1, Math.ceil(all.length/PAGE_SIZE)); applicationPage = Math.min(applicationPage,pages);
  const rows = all.slice((applicationPage-1)*PAGE_SIZE, applicationPage*PAGE_SIZE); const titles = Object.fromEntries(vacancies.map(v=>[v.id,v.title]));
  $('applicationTableBody').innerHTML = rows.length ? rows.map(a=>`<tr class="border-b last:border-0"><td class="px-5 py-3.5"><p class="font-medium">${RBP.escapeHtml(a.candidate_name)}</p><p class="text-xs text-navy/50">${RBP.escapeHtml(a.email)}</p></td><td class="px-5 py-3.5">${RBP.escapeHtml(titles[a.vacancy_id]||'—')}</td><td class="px-5 py-3.5 text-xs">${RBP.formatDate(a.applied_at)}</td><td class="px-5 py-3.5"><span class="badge ${RBP.badgeClass(a.status)}">${RBP.escapeHtml(a.status)}</span></td><td class="px-5 py-3.5 text-right"><button class="view-app text-teal font-semibold text-sm" data-id="${a.id}">View</button></td></tr>`).join('') : '<tr><td colspan="5" class="text-center py-10 text-navy/40">No applications found.</td></tr>';
  $('applicationTableBody').querySelectorAll('.view-app').forEach(b=>b.onclick=()=>openApplication(b.dataset.id));
  $('appPagination').innerHTML = `<button id="prevApps" ${applicationPage===1?'disabled':''} class="disabled:opacity-30">Previous</button><span>Page ${applicationPage} of ${pages} · ${all.length} applications</span><button id="nextApps" ${applicationPage===pages?'disabled':''} class="disabled:opacity-30">Next</button>`;
  $('prevApps').onclick=()=>{applicationPage--;renderApplications();}; $('nextApps').onclick=()=>{applicationPage++;renderApplications();};
}
['appSearch','appStatusFilter','appVacancyFilter'].forEach(id => $(id).addEventListener(id==='appSearch'?'input':'change',()=>{applicationPage=1;renderApplications();}));

function openApplication(id) {
  const a=applications.find(x=>x.id===id); if(!a)return; const title=(vacancies.find(v=>v.id===a.vacancy_id)||{}).title||'Unknown vacancy';
  $('appDetailBody').innerHTML=`<h2 class="font-display font-bold text-xl pr-8">${RBP.escapeHtml(a.candidate_name)}</h2><p class="text-sm text-navy/50">Applied for ${RBP.escapeHtml(title)} on ${RBP.formatDate(a.applied_at)}</p><div class="grid sm:grid-cols-2 gap-4 py-4 border-y"><div><p class="text-xs text-navy/40">Email</p><a class="text-teal" href="mailto:${RBP.escapeHtml(a.email)}">${RBP.escapeHtml(a.email)}</a></div><div><p class="text-xs text-navy/40">Phone</p><p>${RBP.escapeHtml(a.phone)}</p></div><div><p class="text-xs text-navy/40">LinkedIn</p>${a.linkedin_url?`<a target="_blank" rel="noopener" class="text-teal" href="${RBP.escapeHtml(a.linkedin_url)}">Open profile</a>`:'—'}</div><div><p class="text-xs text-navy/40">CV</p><button id="downloadCv" class="text-teal"><i class="fa-solid fa-download mr-1"></i>${RBP.escapeHtml(a.resume_filename||'Download')}</button></div></div><div><p class="text-xs text-navy/40 mb-1">Cover Note</p><p class="text-sm whitespace-pre-line">${RBP.escapeHtml(a.cover_note||'—')}</p></div><div><label for="detailStatus" class="block text-xs font-semibold mb-1">Status</label><select id="detailStatus" class="w-full border rounded-lg px-3 py-2">${APP_STATUSES.map(s=>`<option ${a.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div><label for="detailNotes" class="block text-xs font-semibold mb-1">Internal Notes</label><textarea id="detailNotes" rows="4" class="w-full border rounded-lg px-3 py-2">${RBP.escapeHtml(a.internal_notes||'')}</textarea></div><button id="saveApplication" class="w-full bg-teal text-white rounded-full px-5 py-3 font-semibold">Save Changes</button>`;
  $('downloadCv').onclick=()=>RbpApi.adminDownloadCv(a.id,a.resume_filename).catch(e=>RBP.toast(e.message,'error'));
  $('saveApplication').onclick=async()=>{try{await RbpApi.adminUpdateApplication(a.id,{status:$('detailStatus').value,internal_notes:$('detailNotes').value});closeModal('appDetailModal');RBP.toast('Application updated.','success');await loadAll();}catch(e){RBP.toast(e.message,'error');}};
  $('appDetailModal').classList.remove('hidden');
}

function renderRequests() {
  const body=$('requestTableBody');
  body.innerHTML=requests.length?requests.map(r=>`<tr class="border-b last:border-0"><td class="px-5 py-3.5 font-medium">${RBP.escapeHtml(r.company_name)}</td><td class="px-5 py-3.5 text-xs"><p>${RBP.escapeHtml(r.contact_name)}</p><p>${RBP.escapeHtml(r.email)}</p></td><td class="px-5 py-3.5">${RBP.escapeHtml(r.position_title)}</td><td class="px-5 py-3.5 text-xs">${RBP.formatDate(r.created_at)}</td><td class="px-5 py-3.5"><select class="request-status border rounded-lg px-2 py-1 text-xs" data-id="${r.id}">${REQUEST_STATUSES.map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select></td><td class="px-5 py-3.5 text-right whitespace-nowrap"><button class="view-request text-teal font-semibold text-sm" data-id="${r.id}">View</button><button class="delete-request text-red-500 ml-3" data-id="${r.id}" aria-label="Delete recruitment request"><i class="fa-solid fa-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="6" class="text-center py-10 text-navy/40">No recruitment requests have been received yet.</td></tr>';
  body.querySelectorAll('.request-status').forEach(s=>s.onchange=async()=>{try{await RbpApi.adminUpdateRecruitmentRequest(s.dataset.id,s.value);RBP.toast('Status updated.','success');}catch(e){RBP.toast(e.message,'error');}});
  body.querySelectorAll('.view-request').forEach(b=>b.onclick=()=>openRequest(b.dataset.id));
  body.querySelectorAll('.delete-request').forEach(b=>b.onclick=()=>confirmAction('Remove this recruitment request? It will be hidden immediately and permanently deleted after the 30-day retention grace period.',async()=>{await RbpApi.adminFetch(`api/admin/recruitment-requests/${encodeURIComponent(b.dataset.id)}`,{method:'DELETE'});RBP.toast('Recruitment request removed.','success');await loadAll();}));
}

function openRequest(id) {
  const r=requests.find(x=>x.id===id);if(!r)return;
  $('requestDetailBody').innerHTML=`<h2 class="font-display font-bold text-xl pr-8">${RBP.escapeHtml(r.company_name)}</h2><div class="grid sm:grid-cols-2 gap-4 text-sm"><div><p class="text-xs text-navy/40">Contact</p><p>${RBP.escapeHtml(r.contact_name)}</p></div><div><p class="text-xs text-navy/40">Email</p><a class="text-teal" href="mailto:${RBP.escapeHtml(r.email)}">${RBP.escapeHtml(r.email)}</a></div><div><p class="text-xs text-navy/40">Phone</p><p>${RBP.escapeHtml(r.phone||'—')}</p></div><div><p class="text-xs text-navy/40">Position</p><p>${RBP.escapeHtml(r.position_title)}</p></div><div><p class="text-xs text-navy/40">Employment Type</p><p>${RBP.escapeHtml(r.employment_type)}</p></div><div><p class="text-xs text-navy/40">Location</p><p>${RBP.escapeHtml(r.location||'—')}</p></div><div><p class="text-xs text-navy/40">Salary / Rate</p><p>${RBP.escapeHtml(r.remuneration||'—')}</p></div><div><p class="text-xs text-navy/40">Preferred Start Date</p><p>${RBP.escapeHtml(r.preferred_start_date||'—')}</p></div><div class="sm:col-span-2"><p class="text-xs text-navy/40">Role Requirements</p><p class="whitespace-pre-line">${RBP.escapeHtml(r.requirements||'—')}</p></div><div><p class="text-xs text-navy/40">Submitted</p><p>${RBP.formatDate(r.created_at)}</p></div><div><p class="text-xs text-navy/40">Privacy Acknowledged</p><p>${r.privacy_acknowledged?'Yes':'No'}</p></div></div>`;
  $('requestDetailModal').classList.remove('hidden');
}

function renderInterest() {
  const body=$('interestTableBody');
  body.innerHTML=interest.length?interest.map(c=>`<tr class="border-b last:border-0"><td class="px-5 py-3.5 font-medium">${RBP.escapeHtml(c.name)}</td><td class="px-5 py-3.5 text-xs"><p>${RBP.escapeHtml(c.email)}</p><p>${RBP.escapeHtml(c.phone||'')}</p></td><td class="px-5 py-3.5 text-sm">${RBP.escapeHtml([c.preferred_roles,c.preferred_location].filter(Boolean).join(' · ')||c.message||'—')}</td><td class="px-5 py-3.5 text-xs">${RBP.formatDate(c.created_at)}</td><td class="px-5 py-3.5"><div class="flex items-center gap-3"><select class="interest-status border rounded-lg px-2 py-1 text-xs" data-id="${c.id}">${INTEREST_STATUSES.map(s=>`<option ${c.status===s?'selected':''}>${s}</option>`).join('')}</select><button class="delete-interest text-red-500" data-id="${c.id}" aria-label="Delete candidate registration"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join(''):'<tr><td colspan="5" class="text-center py-10 text-navy/40">No candidate interest registrations yet.</td></tr>';
  body.querySelectorAll('.interest-status').forEach(s=>s.onchange=async()=>{try{await RbpApi.adminUpdateCandidateInterest(s.dataset.id,s.value);RBP.toast('Status updated.','success');}catch(e){RBP.toast(e.message,'error');}});
  body.querySelectorAll('.delete-interest').forEach(b=>b.onclick=()=>confirmAction('Remove this candidate registration? It will be hidden immediately and permanently deleted after the 30-day retention grace period.',async()=>{await RbpApi.adminFetch(`api/admin/candidate-interest/${encodeURIComponent(b.dataset.id)}`,{method:'DELETE'});RBP.toast('Candidate registration removed.','success');await loadAll();}));
}

function closeModal(id){$(id).classList.add('hidden');}
$('closeAppModalBtn').onclick=()=>closeModal('appDetailModal');$('appModalOverlay').onclick=()=>closeModal('appDetailModal');
$('closeRequestModalBtn').onclick=()=>closeModal('requestDetailModal');$('requestModalOverlay').onclick=()=>closeModal('requestDetailModal');
function confirmAction(message,fn){$('confirmMessage').textContent=message;pendingConfirm=fn;$('confirmModal').classList.remove('hidden');}
$('confirmCancelBtn').onclick=()=>closeModal('confirmModal');$('confirmOverlay').onclick=()=>closeModal('confirmModal');$('confirmOkBtn').onclick=async()=>{const fn=pendingConfirm;pendingConfirm=null;closeModal('confirmModal');if(fn)try{await fn();}catch(e){RBP.toast(e.message||'Action failed.','error');}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){['appDetailModal','requestDetailModal','confirmModal'].forEach(closeModal);}});
$('signOutBtn').onclick=async()=>{await RbpApi.signOutStaff();location.href='login.html';};

if (!RbpApi.isFirebaseConfigured()) deny('Firebase authentication has not yet been configured. Complete the deployment steps in DEPLOYMENT.md.');
else RbpApi.onAuthStateChanged(async user=>{if(!user){location.href='login.html';return;}try{const session=await RbpApi.adminGetSession();$('authLoading').classList.add('hidden');$('dashboardRoot').classList.remove('hidden');$('staffIdentity').textContent=`${session.displayName||session.email} (${session.role})`;$('staffIdentity').classList.remove('hidden');switchTab(location.hash.slice(1)||'overview');resetVacancyForm();await loadAll();}catch(err){console.error(err);await RbpApi.signOutStaff();deny(err.status===403?'This Firebase account is not an approved active RBP staff account.':'Your session could not be verified. Please sign in again.');}});
