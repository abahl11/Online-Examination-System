(function () {
  const A = window.TestDesk;
  const me = A.guardPage('admin');
  if (!me) return;

  const $ = (id) => document.getElementById(id);
  const { esc, badge } = A;

  const perfState = { page: 1, search: '' };

  async function loadOverview() {
    try {
      const { data } = await A.api('/reports/overview');
      const tiles = [
        ['Students', data.users.student || 0],
        ['Instructors', data.users.instructor || 0],
        ['Courses', data.courses],
        ['Published exams', data.exams.published || 0],
        ['Draft exams', data.exams.draft || 0],
        ['Finished attempts', data.attempts.finished],
        ['Running now', data.attempts.running],
        ['Average score', `${data.results.averagePercentage}%`],
        ['Awaiting review', data.results.pendingReviews],
      ];
      $('overview-tiles').innerHTML = tiles
        .map(([label, value]) => `<div class="tile"><div class="tile-value">${esc(value)}</div><div class="tile-label">${esc(label)}</div></div>`)
        .join('');
    } catch (error) {
      A.showError(error);
    }
    loadPerformance();
  }

  async function loadPerformance() {
    try {
      const { data, meta } = await A.api(`/reports/exams${A.queryString({ page: perfState.page, search: perfState.search })}`);
      A.fillRows(
        $('perf-rows'),
        data,
        (e) => `<tr>
          <td>${esc(e.title)}</td>
          <td>${esc(e.course?.code || '')}</td>
          <td>${statusBadge(e.status)}</td>
          <td>${e.attempts}</td>
          <td>${e.averagePercentage}%</td>
          <td>${e.highestScore} / ${e.lowestScore}</td>
        </tr>`,
        6,
        'No exams yet.'
      );
      A.drawPager($('perf-pager'), meta, (p) => { perfState.page = p; loadPerformance(); });
    } catch (error) {
      A.showError(error);
    }
  }

  $('perf-search').addEventListener('input', A.debounce((e) => {
    perfState.search = e.target.value;
    perfState.page = 1;
    loadPerformance();
  }));

  function statusBadge(status) {
    const tone = { published: 'good', draft: 'warn', closed: '' }[status];
    return badge(status, tone);
  }

  const userState = { page: 1, search: '', role: '', isActive: '', sort: '-createdAt' };
  let userCache = [];

  async function loadUsers() {
    try {
      const { data, meta } = await A.api(`/users${A.queryString({ ...userState })}`);
      userCache = data;
      A.fillRows(
        $('user-rows'),
        data,
        (u) => `<tr>
          <td>${esc(u.fullName)}${u._id === me.id ? ' <span class="muted small">(you)</span>' : ''}</td>
          <td>${esc(u.email)}</td>
          <td>${badge(u.role?.name || '?', 'info')}</td>
          <td>${u.isActive ? badge('active', 'good') : badge('inactive', 'bad')}</td>
          <td class="small">${A.when(u.lastLoginAt)}</td>
          <td><div class="btn-group">
            <button class="btn btn-quiet btn-sm" data-act="edit" data-id="${u._id}">Edit</button>
            <button class="btn btn-quiet btn-sm" data-act="toggle" data-id="${u._id}">${u.isActive ? 'Deactivate' : 'Activate'}</button>
            <button class="btn btn-danger btn-sm" data-act="delete" data-id="${u._id}">Delete</button>
          </div></td>
        </tr>`,
        6,
        'No users match.'
      );
      A.drawPager($('user-pager'), meta, (p) => { userState.page = p; loadUsers(); });
    } catch (error) {
      A.showError(error);
    }
  }

  function userForm(user) {
    const editing = Boolean(user);
    const role = user?.role?.name || 'student';
    return `
      <form id="user-form" novalidate>
        <div class="field"><label>Full name</label><input name="fullName" value="${esc(user?.fullName || '')}" /></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(user?.email || '')}" ${editing ? 'disabled' : ''} /></div>
        <div class="field-row">
          <div class="field"><label>Role</label>
            <select name="role">
              ${['student', 'instructor', 'admin'].map((r) => `<option value="${r}" ${r === role ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>${editing ? 'New password (optional)' : 'Password'}</label><input name="password" type="password" autocomplete="new-password" /></div>
        </div>
        <label class="check-line"><input type="checkbox" name="isActive" ${user?.isActive === false ? '' : 'checked'} /> Account is active</label>
      </form>`;
  }

  function openUserDialog(user) {
    const dialog = A.openDialog({
      title: user ? 'Edit user' : 'New user',
      body: userForm(user),
      buttons: [
        { label: 'Cancel', tone: 'btn-quiet' },
        {
          label: user ? 'Save changes' : 'Create user',
          onClick: async (close) => {
            const form = dialog.root.querySelector('#user-form');
            const body = {
              fullName: form.fullName.value,
              role: form.elements.role.value,
              isActive: form.isActive.checked,
            };
            if (!user) body.email = form.email.value;
            if (form.password.value) body.password = form.password.value;
            try {
              if (user) await A.api(`/users/${user._id}`, { method: 'PATCH', body });
              else await A.api('/users', { method: 'POST', body });
              A.toast(user ? 'User updated' : 'User created');
              close();
              loadUsers();
            } catch (error) {
              A.showError(error, form);
            }
          },
        },
      ],
    });
  }

  $('new-user').addEventListener('click', () => openUserDialog(null));

  $('user-rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const user = userCache.find((u) => u._id === btn.dataset.id);
    try {
      if (btn.dataset.act === 'edit') openUserDialog(user);
      if (btn.dataset.act === 'toggle') {
        await A.api(`/users/${user._id}`, { method: 'PATCH', body: { isActive: !user.isActive } });
        A.toast(user.isActive ? 'User deactivated' : 'User activated');
        loadUsers();
      }
      if (btn.dataset.act === 'delete' && (await A.confirmAction(`Delete ${user.fullName}? This cannot be undone.`, 'Delete'))) {
        await A.api(`/users/${user._id}`, { method: 'DELETE' });
        A.toast('User deleted');
        loadUsers();
      }
    } catch (error) {
      A.showError(error);
    }
  });

  $('user-search').addEventListener('input', A.debounce((e) => { userState.search = e.target.value; userState.page = 1; loadUsers(); }));
  $('user-role').addEventListener('change', (e) => { userState.role = e.target.value; userState.page = 1; loadUsers(); });
  $('user-status').addEventListener('change', (e) => { userState.isActive = e.target.value; userState.page = 1; loadUsers(); });
  $('user-sort').addEventListener('change', (e) => { userState.sort = e.target.value; loadUsers(); });

  const courseState = { page: 1, search: '', sort: 'title' };
  let courseCache = [];

  async function loadCourses() {
    try {
      const { data, meta } = await A.api(`/courses${A.queryString(courseState)}`);
      courseCache = data;
      A.fillRows(
        $('course-rows'),
        data,
        (c) => `<tr>
          <td><strong>${esc(c.code)}</strong></td>
          <td>${esc(c.title)}<div class="muted small clip">${esc(c.description)}</div></td>
          <td>${c.instructors.length ? c.instructors.map((i) => esc(i.fullName)).join(', ') : '<span class="muted">None assigned</span>'}</td>
          <td><div class="btn-group">
            <button class="btn btn-quiet btn-sm" data-act="edit" data-id="${c._id}">Edit</button>
            <button class="btn btn-quiet btn-sm" data-act="assign" data-id="${c._id}">Instructors</button>
            <button class="btn btn-danger btn-sm" data-act="delete" data-id="${c._id}">Delete</button>
          </div></td>
        </tr>`,
        4,
        'No courses yet.'
      );
      A.drawPager($('course-pager'), meta, (p) => { courseState.page = p; loadCourses(); });
    } catch (error) {
      A.showError(error);
    }
  }

  function openCourseDialog(course) {
    const dialog = A.openDialog({
      title: course ? 'Edit course' : 'New course',
      body: `
        <form id="course-form" novalidate>
          <div class="field-row">
            <div class="field"><label>Code</label><input name="code" value="${esc(course?.code || '')}" placeholder="CS201" /></div>
            <div class="field" style="grid-column: span 2"><label>Title</label><input name="title" value="${esc(course?.title || '')}" /></div>
          </div>
          <div class="field"><label>Description</label><textarea name="description">${esc(course?.description || '')}</textarea></div>
        </form>`,
      buttons: [
        { label: 'Cancel', tone: 'btn-quiet' },
        {
          label: course ? 'Save changes' : 'Create course',
          onClick: async (close) => {
            const form = dialog.root.querySelector('#course-form');
            const body = { code: form.code.value, title: form.elements.title.value, description: form.description.value };
            try {
              if (course) await A.api(`/courses/${course._id}`, { method: 'PATCH', body });
              else await A.api('/courses', { method: 'POST', body });
              A.toast(course ? 'Course updated' : 'Course created');
              close();
              loadCourses();
            } catch (error) {
              A.showError(error, form);
            }
          },
        },
      ],
    });
  }

  async function openAssignDialog(course) {
    let instructors;
    try {
      ({ data: instructors } = await A.api('/users?role=instructor&isActive=true&limit=100&sort=fullName'));
    } catch (error) {
      A.showError(error);
      return;
    }
    const chosen = new Set(course.instructors.map((i) => i._id));
    const list = instructors.length
      ? instructors
          .map((i) => `<label><input type="checkbox" value="${i._id}" ${chosen.has(i._id) ? 'checked' : ''}/> <span>${esc(i.fullName)} <span class="muted small">${esc(i.email)}</span></span></label>`)
          .join('')
      : '<p class="muted">No active instructors yet. Create one under Users first.</p>';

    const dialog = A.openDialog({
      title: `Instructors for ${course.code}`,
      body: `<p class="muted small">Assigned instructors can build the question bank and exams of this course.</p><div class="pool-list">${list}</div>`,
      buttons: [
        { label: 'Cancel', tone: 'btn-quiet' },
        {
          label: 'Save assignment',
          onClick: async (close) => {
            const instructorIds = [...dialog.root.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.value);
            try {
              await A.api(`/courses/${course._id}/instructors`, { method: 'PUT', body: { instructorIds } });
              A.toast('Instructors updated');
              close();
              loadCourses();
            } catch (error) {
              A.showError(error);
            }
          },
        },
      ],
    });
  }

  $('new-course').addEventListener('click', () => openCourseDialog(null));

  $('course-rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const course = courseCache.find((c) => c._id === btn.dataset.id);
    if (btn.dataset.act === 'edit') openCourseDialog(course);
    if (btn.dataset.act === 'assign') openAssignDialog(course);
    if (btn.dataset.act === 'delete' && (await A.confirmAction(`Delete course ${course.code}?`, 'Delete'))) {
      try {
        await A.api(`/courses/${course._id}`, { method: 'DELETE' });
        A.toast('Course deleted');
        loadCourses();
      } catch (error) {
        A.showError(error);
      }
    }
  });

  $('course-search').addEventListener('input', A.debounce((e) => { courseState.search = e.target.value; courseState.page = 1; loadCourses(); }));
  $('course-sort').addEventListener('change', (e) => { courseState.sort = e.target.value; loadCourses(); });

  const auditState = { page: 1, search: '', action: '', limit: 15 };

  async function loadAudit() {
    try {
      const { data, meta } = await A.api(`/audit-logs${A.queryString(auditState)}`);
      A.fillRows(
        $('audit-rows'),
        data,
        (log) => `<tr>
          <td class="small">${A.when(log.createdAt)}</td>
          <td>${log.actor ? esc(log.actor.fullName) : '<span class="muted">guest</span>'} <span class="muted small">${esc(log.actorRole)}</span></td>
          <td><code>${esc(log.action)}</code></td>
          <td class="small">${esc(log.entity || '—')}</td>
          <td class="small clip" title="${esc(JSON.stringify(log.details || {}))}">${esc(JSON.stringify(log.details || {}))}</td>
          <td class="small">${esc(log.ip)}</td>
        </tr>`,
        6,
        'No audit entries.'
      );
      A.drawPager($('audit-pager'), meta, (p) => { auditState.page = p; loadAudit(); });
    } catch (error) {
      A.showError(error);
    }
  }

  $('audit-search').addEventListener('input', A.debounce((e) => { auditState.search = e.target.value; auditState.page = 1; loadAudit(); }));
  $('audit-action').addEventListener('change', (e) => { auditState.action = e.target.value; auditState.page = 1; loadAudit(); });

  const loaders = { overview: loadOverview, users: loadUsers, courses: loadCourses, audit: loadAudit };
  A.wireSideMenu((view) => loaders[view]());
  loadOverview();
})();
