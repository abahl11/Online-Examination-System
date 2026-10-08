(function () {
  const A = window.TestDesk;
  const me = A.guardPage('instructor');
  if (!me) return;

  const $ = (id) => document.getElementById(id);
  const { esc, badge } = A;
  let myCourses = [];

  const courseOptions = (selectedId, includeAll) =>
    (includeAll ? '<option value="">All my courses</option>' : '') +
    myCourses.map((c) => `<option value="${c._id}" ${c._id === selectedId ? 'selected' : ''}>${esc(c.code)} — ${esc(c.title)}</option>`).join('');

  async function loadCourses() {
    try {
      const { data } = await A.api('/courses?limit=100&sort=title');
      myCourses = data;
      $('bank-course').innerHTML = courseOptions('', true);
      $('exam-course').innerHTML = courseOptions('', true);
      $('course-cards').innerHTML = data.length
        ? data
            .map(
              (c) => `<div class="panel exam-card">
                <div><span class="badge info">${esc(c.code)}</span></div>
                <h3>${esc(c.title)}</h3>
                <p class="muted small">${esc(c.description || 'No description')}</p>
                <div class="card-foot">
                  <button class="btn btn-quiet btn-sm" data-jump="bank" data-course="${c._id}">Question bank</button>
                  <button class="btn btn-sm" data-jump="exams" data-course="${c._id}">Exams</button>
                </div>
              </div>`
            )
            .join('')
        : '<div class="panel muted">You are not assigned to any course yet. Ask the administrator to assign you.</div>';
    } catch (error) {
      A.showError(error);
    }
  }

  $('course-cards').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-jump]');
    if (!btn) return;
    if (btn.dataset.jump === 'bank') {
      bankState.course = btn.dataset.course;
      $('bank-course').value = btn.dataset.course;
    } else {
      examState.course = btn.dataset.course;
      $('exam-course').value = btn.dataset.course;
    }
    showView(btn.dataset.jump);
  });

  const bankState = { page: 1, course: '', kind: '', search: '', sort: '-createdAt' };
  let bankCache = [];

  async function loadBank() {
    try {
      const { data, meta } = await A.api(`/questions${A.queryString(bankState)}`);
      bankCache = data;
      A.fillRows(
        $('bank-rows'),
        data,
        (q) => `<tr>
          <td><div class="clip" title="${esc(q.prompt)}">${esc(q.prompt)}</div></td>
          <td>${q.kind === 'mcq' ? badge('MCQ', 'info') : badge('Coding', 'warn')}</td>
          <td>${esc(q.course?.code || '')}</td>
          <td>${q.marks}</td>
          <td><div class="btn-group">
            <button class="btn btn-quiet btn-sm" data-act="edit" data-id="${q._id}">Edit</button>
            <button class="btn btn-danger btn-sm" data-act="delete" data-id="${q._id}">Delete</button>
          </div></td>
        </tr>`,
        5,
        'No questions yet. Use "Add question" to start your bank.'
      );
      A.drawPager($('bank-pager'), meta, (p) => { bankState.page = p; loadBank(); });
    } catch (error) {
      A.showError(error);
    }
  }

  function optionRow(option = { text: '', isCorrect: false }) {
    return `<div class="option-row">
      <input type="radio" name="correct" ${option.isCorrect ? 'checked' : ''} title="Correct answer" />
      <input type="text" class="option-text" value="${esc(option.text)}" placeholder="Option text" />
      <button type="button" class="btn btn-quiet btn-sm" data-remove-option>&times;</button>
    </div>`;
  }

  function questionForm(q) {
    const kind = q?.kind || 'mcq';
    const options = q?.options?.length ? q.options : [{}, {}, {}, {}].map(() => ({ text: '', isCorrect: false }));
    const defaultCourse = q?.course?._id || bankState.course || myCourses[0]?._id;
    return `
      <form id="question-form" novalidate>
        <div class="field-row">
          <div class="field"><label>Course</label><select name="course" ${q ? 'disabled' : ''}>${courseOptions(defaultCourse)}</select></div>
          <div class="field"><label>Type</label>
            <select name="kind" ${q ? 'disabled' : ''}>
              <option value="mcq" ${kind === 'mcq' ? 'selected' : ''}>Multiple choice</option>
              <option value="coding" ${kind === 'coding' ? 'selected' : ''}>Coding</option>
            </select>
          </div>
          <div class="field"><label>Marks</label><input name="marks" type="number" min="0.5" step="0.5" value="${q?.marks ?? 1}" /></div>
        </div>
        <div class="field"><label>Question</label><textarea name="prompt">${esc(q?.prompt || '')}</textarea></div>

        <div data-part="mcq" class="${kind === 'mcq' ? '' : 'hidden'}">
          <div class="field">
            <span class="label">Options <span class="muted small">— select the radio next to the correct one</span></span>
            <div id="option-list">${options.map(optionRow).join('')}</div>
            <input type="hidden" name="options" />
            <button type="button" class="btn btn-quiet btn-sm" id="add-option">+ Add option</button>
          </div>
        </div>

        <div data-part="coding" class="${kind === 'coding' ? '' : 'hidden'}">
          <div class="field"><label>Language</label><input name="language" value="${esc(q?.language || 'javascript')}" /></div>
        </div>
      </form>`;
  }

  function openQuestionDialog(question) {
    if (!myCourses.length) return A.toast('You need to be assigned to a course first', 'fail');

    const dialog = A.openDialog({
      title: question ? 'Edit question' : 'Add question',
      body: questionForm(question),
      wide: true,
      buttons: [
        { label: 'Cancel', tone: 'btn-quiet' },
        { label: question ? 'Save changes' : 'Add to bank', onClick: (close) => saveQuestion(dialog, question, close) },
      ],
    });
    const form = dialog.root.querySelector('#question-form');

    form.kind.addEventListener('change', () => {
      form.querySelector('[data-part="mcq"]').classList.toggle('hidden', form.kind.value !== 'mcq');
      form.querySelector('[data-part="coding"]').classList.toggle('hidden', form.kind.value !== 'coding');
    });
    dialog.root.querySelector('#add-option').addEventListener('click', () => {
      dialog.root.querySelector('#option-list').insertAdjacentHTML('beforeend', optionRow());
    });
    dialog.root.querySelector('#option-list').addEventListener('click', (e) => {
      if (e.target.closest('[data-remove-option]')) e.target.closest('.option-row').remove();
    });
  }

  async function saveQuestion(dialog, question, close) {
    const form = dialog.root.querySelector('#question-form');
    const kind = form.kind.value;
    const body = {
      prompt: form.prompt.value,
      marks: Number(form.marks.value),
    };
    if (!question) {
      body.course = form.course.value;
      body.kind = kind;
    }
    if (kind === 'mcq') {
      body.options = [...form.querySelectorAll('.option-row')]
        .map((row) => ({ text: row.querySelector('.option-text').value.trim(), isCorrect: row.querySelector('[type=radio]').checked }))
        .filter((opt) => opt.text);
    } else {
      body.language = form.language.value;
    }

    try {
      if (question) await A.api(`/questions/${question._id}`, { method: 'PATCH', body });
      else await A.api('/questions', { method: 'POST', body });
      A.toast(question ? 'Question updated' : 'Question added');
      close();
      loadBank();
    } catch (error) {
      A.showError(error, form);
    }
  }

  $('new-question').addEventListener('click', () => openQuestionDialog(null));

  $('bank-rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const question = bankCache.find((q) => q._id === btn.dataset.id);
    if (btn.dataset.act === 'edit') openQuestionDialog(question);
    if (btn.dataset.act === 'delete' && (await A.confirmAction('Delete this question from the bank?', 'Delete'))) {
      try {
        await A.api(`/questions/${question._id}`, { method: 'DELETE' });
        A.toast('Question deleted');
        loadBank();
      } catch (error) {
        A.showError(error);
      }
    }
  });

  $('bank-course').addEventListener('change', (e) => { bankState.course = e.target.value; bankState.page = 1; loadBank(); });
  $('bank-kind').addEventListener('change', (e) => { bankState.kind = e.target.value; bankState.page = 1; loadBank(); });
  $('bank-sort').addEventListener('change', (e) => { bankState.sort = e.target.value; loadBank(); });
  $('bank-search').addEventListener('input', A.debounce((e) => { bankState.search = e.target.value; bankState.page = 1; loadBank(); }));

  const examState = { page: 1, course: '', status: '', search: '', sort: '-createdAt' };
  let examCache = [];

  const STATUS_TONE = { draft: 'warn', published: 'good', closed: '' };

  function examActions(exam) {
    const b = (act, label, tone = 'btn-quiet') => `<button class="btn ${tone} btn-sm" data-act="${act}" data-id="${exam._id}">${label}</button>`;
    const list = [];
    if (exam.status === 'draft') list.push(b('edit', 'Edit'), b('publish', 'Publish', ''), b('delete', 'Delete', 'btn-danger'));
    if (exam.status === 'published') list.push(b('close', 'Close', 'btn-warn'), b('unpublish', 'Back to draft'));
    if (exam.status === 'closed') {
      list.push(b('reopen', 'Reopen'));
      if (!exam.resultsPublished) list.push(b('release', 'Publish results', ''));
    }
    if (exam.status !== 'draft') list.push(b('results', 'Results'), b('board', 'Leaderboard'));
    return `<div class="btn-group">${list.join('')}</div>`;
  }

  async function loadExams() {
    try {
      const { data, meta } = await A.api(`/exams${A.queryString(examState)}`);
      examCache = data;
      A.fillRows(
        $('exam-rows'),
        data,
        (e) => `<tr>
          <td><strong>${esc(e.title)}</strong>
            <div class="muted small">${e.maxAttempts} attempt(s) · −${e.negativeMark} per wrong MCQ</div></td>
          <td>${esc(e.course?.code || '')}</td>
          <td>${badge(e.status, STATUS_TONE[e.status])}</td>
          <td>${e.durationMinutes} min</td>
          <td>${e.questionCount} of ${e.poolSize}</td>
          <td>${e.resultsPublished ? badge('published', 'good') : badge('hidden')}</td>
          <td>${examActions(e)}</td>
        </tr>`,
        7,
        'No exams yet.'
      );
      A.drawPager($('exam-pager'), meta, (p) => { examState.page = p; loadExams(); });
    } catch (error) {
      A.showError(error);
    }
  }

  function examForm(exam) {
    const v = (key, fallback = '') => esc(exam?.[key] ?? fallback);
    const courseId = exam?.course?._id || exam?.course || examState.course || myCourses[0]?._id;
    return `
      <form id="exam-form" novalidate>
        <div class="field-row">
          <div class="field" style="grid-column: span 2"><label>Title</label><input name="title" value="${v('title')}" /></div>
          <div class="field"><label>Course</label><select name="course" ${exam ? 'disabled' : ''}>${courseOptions(courseId)}</select></div>
        </div>
        <div class="field"><label>Instructions for students</label><textarea name="description">${v('description')}</textarea></div>
        <div class="field-row">
          <div class="field"><label>Duration (minutes)</label><input name="durationMinutes" type="number" min="1" value="${v('durationMinutes', 30)}" /></div>
          <div class="field"><label>Questions per attempt <span class="muted small">(0 = all)</span></label><input name="questionsPerAttempt" type="number" min="0" value="${v('questionsPerAttempt', 0)}" /></div>
          <div class="field"><label>Max attempts</label><input name="maxAttempts" type="number" min="1" max="10" value="${v('maxAttempts', 1)}" /></div>
        </div>
        <div class="field"><label>Negative mark per wrong MCQ</label><input name="negativeMark" type="number" min="0" step="0.25" value="${v('negativeMark', 0)}" /></div>
        <div class="field">
          <span class="label">Question pool <span class="muted small" id="pool-count"></span></span>
          <input type="hidden" name="questions" />
          <div class="pool-list" id="pool-list"><span class="muted">Loading…</span></div>
        </div>
      </form>`;
  }

  async function fillPool(dialog, courseId, selectedIds) {
    const box = dialog.root.querySelector('#pool-list');
    const counter = dialog.root.querySelector('#pool-count');
    const refreshCount = () => {
      counter.textContent = `— ${box.querySelectorAll('input:checked').length} selected`;
    };
    try {
      const { data } = await A.api(`/questions?course=${courseId}&limit=100&sort=createdAt`);
      box.innerHTML = data.length
        ? data
            .map((q) => `<label><input type="checkbox" value="${q._id}" ${selectedIds.has(q._id) ? 'checked' : ''} />
              <span>${q.kind === 'mcq' ? badge('MCQ', 'info') : badge('Coding', 'warn')} ${esc(q.prompt)} <span class="muted small">(${q.marks} marks)</span></span></label>`)
            .join('')
        : '<span class="muted">This course has no questions yet. Add some in the Question bank first.</span>';
      box.onchange = refreshCount;
      refreshCount();
    } catch (error) {
      A.showError(error);
    }
  }

  async function openExamDialog(examSummary) {
    if (!myCourses.length) return A.toast('You need to be assigned to a course first', 'fail');

    let exam = null;
    if (examSummary) {
      try {
        ({ data: exam } = await A.api(`/exams/${examSummary._id}`));
      } catch (error) {
        return A.showError(error);
      }
    }
    const selected = new Set((exam?.questions || []).map((q) => q._id || q));

    const dialog = A.openDialog({
      title: exam ? 'Edit exam' : 'New exam',
      body: examForm(exam),
      wide: true,
      buttons: [
        { label: 'Cancel', tone: 'btn-quiet' },
        { label: exam ? 'Save changes' : 'Create draft', onClick: (close) => saveExam(dialog, exam, close) },
      ],
    });
    const form = dialog.root.querySelector('#exam-form');
    fillPool(dialog, form.course.value, selected);
    form.course.addEventListener('change', () => fillPool(dialog, form.course.value, new Set()));
  }

  async function saveExam(dialog, exam, close) {
    const form = dialog.root.querySelector('#exam-form');
    const body = {
      title: form.elements.title.value,
      description: form.description.value,
      durationMinutes: Number(form.durationMinutes.value),
      questionsPerAttempt: Number(form.questionsPerAttempt.value),
      maxAttempts: Number(form.maxAttempts.value),
      negativeMark: Number(form.negativeMark.value),
      questions: [...dialog.root.querySelectorAll('#pool-list input:checked')].map((c) => c.value),
    };
    if (!exam) body.course = form.course.value;

    try {
      if (exam) await A.api(`/exams/${exam._id}`, { method: 'PATCH', body });
      else await A.api('/exams', { method: 'POST', body });
      A.toast(exam ? 'Exam updated' : 'Draft exam created');
      close();
      loadExams();
    } catch (error) {
      A.showError(error, form);
    }
  }

  async function setStatus(exam, status, question) {
    if (question && !(await A.confirmAction(question))) return;
    try {
      await A.api(`/exams/${exam._id}/status`, { method: 'PATCH', body: { status } });
      A.toast(`Exam is now ${status}`);
      loadExams();
    } catch (error) {
      A.showError(error);
    }
  }

  $('exam-rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const exam = examCache.find((x) => x._id === btn.dataset.id);

    switch (btn.dataset.act) {
      case 'edit':
        return openExamDialog(exam);
      case 'publish':
        return setStatus(exam, 'published', 'Publish this exam? Students will be able to start it.');
      case 'unpublish':
        return setStatus(exam, 'draft');
      case 'close':
        return setStatus(exam, 'closed', 'Close this exam? Any running attempts are submitted immediately.');
      case 'reopen':
        return setStatus(exam, 'published');
      case 'results':
        return openResultsDialog(exam);
      case 'board':
        return openLeaderboard(exam);
      case 'release':
        if (!(await A.confirmAction('Publish results? Students will see their scores and the leaderboard.'))) return;
        try {
          await A.api(`/exams/${exam._id}/publish-results`, { method: 'POST' });
          A.toast('Results published');
          loadExams();
        } catch (error) {
          A.showError(error);
        }
        return;
      case 'delete':
        if (!(await A.confirmAction(`Delete "${exam.title}"?`, 'Delete'))) return;
        try {
          await A.api(`/exams/${exam._id}`, { method: 'DELETE' });
          A.toast('Exam deleted');
          loadExams();
        } catch (error) {
          A.showError(error);
        }
        return;
      default:
    }
  });

  $('new-exam').addEventListener('click', () => openExamDialog(null));
  $('exam-course').addEventListener('change', (e) => { examState.course = e.target.value; examState.page = 1; loadExams(); });
  $('exam-status').addEventListener('change', (e) => { examState.status = e.target.value; examState.page = 1; loadExams(); });
  $('exam-sort').addEventListener('change', (e) => { examState.sort = e.target.value; loadExams(); });
  $('exam-search').addEventListener('input', A.debounce((e) => { examState.search = e.target.value; examState.page = 1; loadExams(); }));

  const REVIEW_TONE = { auto: 'info', pending: 'warn', reviewed: 'good' };

  function openResultsDialog(exam) {
    const state = { page: 1, reviewStatus: '', sort: '-createdAt' };
    const dialog = A.openDialog({
      title: `Results — ${exam.title}`,
      wide: true,
      body: `
        <div class="toolbar">
          <select data-filter="reviewStatus">
            <option value="">All results</option>
            <option value="pending">Waiting for review</option>
            <option value="reviewed">Reviewed</option>
            <option value="auto">Auto-marked</option>
          </select>
          <select data-filter="sort">
            <option value="-createdAt">Latest first</option>
            <option value="-totalScore">Highest score</option>
            <option value="totalScore">Lowest score</option>
            <option value="timeTakenSeconds">Fastest</option>
          </select>
        </div>
        <div class="table-wrap"><table class="grid">
          <thead><tr><th>Student</th><th>Attempt</th><th>Score</th><th>%</th><th>Review</th><th>Time</th><th></th></tr></thead>
          <tbody data-slot="rows"></tbody>
        </table></div>
        <div class="pager" data-slot="pager"></div>`,
    });

    const rows = dialog.root.querySelector('[data-slot="rows"]');
    const pager = dialog.root.querySelector('[data-slot="pager"]');

    async function load() {
      try {
        const { data, meta } = await A.api(`/exams/${exam._id}/results${A.queryString(state)}`);
        A.fillRows(
          rows,
          data,
          (r) => `<tr>
            <td>${esc(r.student?.fullName || '—')}<div class="muted small">${esc(r.student?.email || '')}</div></td>
            <td>#${r.attempt?.attemptNumber ?? '?'}</td>
            <td>${r.totalScore} / ${r.maxScore}</td>
            <td>${r.percentage}%</td>
            <td>${badge(r.reviewStatus, REVIEW_TONE[r.reviewStatus])}</td>
            <td class="small">${A.minutesAndSeconds(r.timeTakenSeconds)}</td>
            <td><button class="btn btn-quiet btn-sm" data-open="${r._id}">${r.reviewStatus === 'pending' ? 'Review' : 'Open'}</button></td>
          </tr>`,
          7,
          'No submissions yet.'
        );
        A.drawPager(pager, meta, (p) => { state.page = p; load(); });
      } catch (error) {
        A.showError(error);
      }
    }

    dialog.root.querySelectorAll('[data-filter]').forEach((select) =>
      select.addEventListener('change', () => { state[select.dataset.filter] = select.value; state.page = 1; load(); })
    );
    rows.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-open]');
      if (btn) openReviewDialog(btn.dataset.open, load);
    });
    load();
  }

  function markLineHtml(line, index) {
    const tone = { correct: 'good', wrong: 'bad', unanswered: '', pending: 'warn', reviewed: 'info' }[line.outcome];
    let detail = '';
    if (line.kind === 'mcq') {
      detail = `<div class="small">Answer: <strong>${esc(line.selectedText || '—')}</strong> · Correct: ${esc(line.correctText)}</div>`;
    } else if (line.outcome !== 'unanswered') {
      detail = `<pre>${esc(line.codeAnswer)}</pre>
        <div class="field-row" data-grade="${line.question}">
          <div class="field"><label>Marks (max ${line.maxMarks})</label><input type="number" min="0" max="${line.maxMarks}" step="0.5" name="marks" value="${line.marksAwarded}" /></div>
          <div class="field" style="grid-column: span 2"><label>Feedback</label><input name="feedback" value="${esc(line.feedback)}" /></div>
        </div>`;
    }
    return `<div class="mark-line">
      <div class="line-head"><strong>${index + 1}. ${esc(line.prompt)}</strong><span>${badge(line.outcome, tone)} ${line.marksAwarded}/${line.maxMarks}</span></div>
      ${detail}
    </div>`;
  }

  async function openReviewDialog(resultId, afterSave) {
    let result;
    try {
      ({ data: result } = await A.api(`/results/${resultId}`));
    } catch (error) {
      return A.showError(error);
    }
    const gradable = result.lines.some((l) => l.kind === 'coding' && l.outcome !== 'unanswered');

    const dialog = A.openDialog({
      title: `${result.student.fullName} — attempt #${result.attempt.attemptNumber}`,
      wide: true,
      body: `
        <div class="score-banner">
          <div class="big">${result.totalScore} / ${result.maxScore}</div>
          <div>${result.percentage}%<br /><span class="muted small">MCQ ${result.mcqScore} · Coding ${result.codingScore}</span></div>
        </div>
        ${result.lines.map(markLineHtml).join('')}`,
      buttons: gradable
        ? [
            { label: 'Close', tone: 'btn-quiet' },
            {
              label: 'Save marks',
              onClick: async (close) => {
                const grades = [...dialog.root.querySelectorAll('[data-grade]')].map((row) => ({
                  question: row.dataset.grade,
                  marks: Number(row.querySelector('[name=marks]').value),
                  feedback: row.querySelector('[name=feedback]').value,
                }));
                try {
                  await A.api(`/results/${result._id}/review`, { method: 'PATCH', body: { grades } });
                  A.toast('Marks saved');
                  close();
                  afterSave();
                } catch (error) {
                  A.showError(error);
                }
              },
            },
          ]
        : [{ label: 'Close', tone: 'btn-quiet' }],
    });
  }

  async function openLeaderboard(exam) {
    try {
      const { data } = await A.api(`/exams/${exam._id}/leaderboard?limit=50`);
      A.openDialog({
        title: `Leaderboard — ${exam.title}`,
        body: `<div class="table-wrap"><table class="grid">
          <thead><tr><th>Rank</th><th>Student</th><th>Best score</th><th>%</th><th>Time</th><th>Attempts</th></tr></thead>
          <tbody>${
            data.rows.length
              ? data.rows
                  .map((r) => `<tr><td>${r.rank}</td><td>${esc(r.student?.fullName || '—')}</td><td>${r.bestScore}</td><td>${r.bestPercentage}%</td><td>${A.minutesAndSeconds(r.timeTakenSeconds)}</td><td>${r.attemptsUsed}</td></tr>`)
                  .join('')
              : '<tr><td class="empty" colspan="6">No submissions yet.</td></tr>'
          }</tbody></table></div>`,
        buttons: [{ label: 'Close', tone: 'btn-quiet' }],
      });
    } catch (error) {
      A.showError(error);
    }
  }

  const loaders = { courses: loadCourses, bank: loadBank, exams: loadExams };
  const showView = A.wireSideMenu((view) => loaders[view]());
  loadCourses();
})();
