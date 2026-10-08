(function () {
  const A = window.TestDesk;
  const me = A.guardPage('student');
  if (!me) return;

  const $ = (id) => document.getElementById(id);
  const { esc, badge } = A;

  const roomLink = (attemptId) => `/exam-room.html?attempt=${encodeURIComponent(attemptId)}`;

  const examState = { page: 1, search: '', sort: '-createdAt', limit: 9 };
  let examCache = [];

  function examCard(exam) {
    let action;
    if (exam.liveAttemptId) {
      action = `<a class="btn btn-warn" href="${roomLink(exam.liveAttemptId)}">Resume</a>`;
    } else if (exam.attemptsLeft <= 0) {
      action = '<button class="btn" disabled>No attempts left</button>';
    } else {
      action = `<button class="btn" data-start="${exam._id}">${exam.attemptsUsed ? 'Try again' : 'Start exam'}</button>`;
    }

    return `<div class="panel exam-card">
      <div class="facts">${badge(exam.course?.code || '', 'info')}</div>
      <h3>${esc(exam.title)}</h3>
      <p class="muted small">${esc(exam.description || '')}</p>
      <div class="facts small">
        ${badge(`${exam.durationMinutes} min`)}
        ${badge(`${exam.questionCount} questions`)}
        ${exam.negativeMark ? badge(`−${exam.negativeMark} per wrong`, 'bad') : ''}
      </div>
      <div class="card-foot">
        <span class="muted small">Attempts: ${exam.attemptsUsed} / ${exam.maxAttempts}</span>
        ${action}
      </div>
    </div>`;
  }

  async function loadExams() {
    try {
      const { data, meta } = await A.api(`/exams${A.queryString(examState)}`);
      examCache = data;
      $('exam-cards').innerHTML = data.length
        ? data.map(examCard).join('')
        : '<div class="panel muted">No exams are available right now.</div>';
      A.drawPager($('exam-pager'), meta, (p) => { examState.page = p; loadExams(); });
    } catch (error) {
      A.showError(error);
    }
  }

  $('exam-cards').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-start]');
    if (!btn) return;
    const exam = examCache.find((x) => x._id === btn.dataset.start);
    const rules = [
      `You will have ${exam.durationMinutes} minutes. The timer keeps running even if you close the tab.`,
      'Answers are saved automatically, and the exam is submitted for you when time runs out.',
      exam.negativeMark ? `Each wrong MCQ answer deducts ${exam.negativeMark} mark(s). Skipping costs nothing.` : null,
      `This uses attempt ${exam.attemptsUsed + 1} of ${exam.maxAttempts}.`,
    ].filter(Boolean);

    if (!(await A.confirmAction(rules.join(' '), 'Start now'))) return;
    try {
      const { data } = await A.api('/attempts', { method: 'POST', body: { examId: exam._id } });
      window.location.href = roomLink(data._id);
    } catch (error) {
      A.showError(error);
      loadExams();
    }
  });

  $('exam-search').addEventListener('input', A.debounce((e) => { examState.search = e.target.value; examState.page = 1; loadExams(); }));
  $('exam-sort').addEventListener('change', (e) => { examState.sort = e.target.value; loadExams(); });

  const scoreState = { page: 1, sort: '-createdAt' };

  function resultButtons(resultId, examId) {
    return `<div class="btn-group">
      <button class="btn btn-quiet btn-sm" data-view-result="${resultId}">View</button>
      <button class="btn btn-quiet btn-sm" data-pdf="${resultId}">PDF</button>
      <button class="btn btn-quiet btn-sm" data-board="${examId}">Leaderboard</button>
    </div>`;
  }

  async function loadScores() {
    try {
      const { data, meta } = await A.api(`/results/mine${A.queryString(scoreState)}`);
      A.fillRows(
        $('score-rows'),
        data,
        (r) => `<tr>
          <td>${esc(r.exam?.title || '—')} <span class="muted small">${esc(r.exam?.course?.code || '')}</span></td>
          <td>#${r.attempt?.attemptNumber ?? '?'}</td>
          <td>${r.published ? `${r.totalScore} / ${r.maxScore} <span class="muted small">(${r.percentage}%)</span>` : '<span class="muted">Awaiting publication</span>'}</td>
          <td class="small">${A.when(r.createdAt)}</td>
          <td>${r.published ? resultButtons(r._id, r.exam._id) : ''}</td>
        </tr>`,
        5,
        'You have not finished any exam yet.'
      );
      A.drawPager($('score-pager'), meta, (p) => { scoreState.page = p; loadScores(); });
    } catch (error) {
      A.showError(error);
    }
  }

  $('score-sort').addEventListener('change', (e) => { scoreState.sort = e.target.value; loadScores(); });

  const historyState = { page: 1 };
  const ATTEMPT_LABEL = {
    in_progress: ['in progress', 'warn'],
    submitted: ['submitted', 'good'],
    auto_submitted: ['auto-submitted', 'info'],
  };

  async function loadHistory() {
    try {
      const { data, meta } = await A.api(`/attempts/mine${A.queryString(historyState)}`);
      A.fillRows(
        $('history-rows'),
        data,
        (a) => {
          const [label, tone] = ATTEMPT_LABEL[a.status];
          let actions = '';
          if (a.status === 'in_progress') actions = `<a class="btn btn-warn btn-sm" href="${roomLink(a._id)}">Resume</a>`;
          else if (a.score) actions = resultButtons(a.resultId, a.exam._id);
          return `<tr>
            <td>${esc(a.exam?.title || '—')} <span class="muted small">${esc(a.exam?.course?.code || '')}</span></td>
            <td>#${a.attemptNumber}</td>
            <td class="small">${A.when(a.startedAt)}</td>
            <td class="small">${A.when(a.submittedAt)}</td>
            <td>${badge(label, tone)}</td>
            <td>${a.score ? `${a.score.total} / ${a.score.max}` : a.status === 'in_progress' ? '—' : '<span class="muted small">not published</span>'}</td>
            <td>${actions}</td>
          </tr>`;
        },
        7,
        'No attempts yet.'
      );
      A.drawPager($('history-pager'), meta, (p) => { historyState.page = p; loadHistory(); });
    } catch (error) {
      A.showError(error);
    }
  }

  async function showResult(resultId) {
    try {
      const { data: r } = await A.api(`/results/${resultId}`);
      const lines = r.lines
        .map((line, i) => {
          const tone = { correct: 'good', wrong: 'bad', unanswered: '', pending: 'warn', reviewed: 'info' }[line.outcome];
          const extra =
            line.kind === 'mcq'
              ? `<div class="small">Your answer: <strong>${esc(line.selectedText || '—')}</strong> · Correct answer: ${esc(line.correctText)}</div>`
              : `${line.codeAnswer ? `<pre>${esc(line.codeAnswer)}</pre>` : ''}${line.feedback ? `<div class="small">Feedback: ${esc(line.feedback)}</div>` : ''}`;
          return `<div class="mark-line">
            <div class="line-head"><strong>${i + 1}. ${esc(line.prompt)}</strong><span>${badge(line.outcome, tone)} ${line.marksAwarded}/${line.maxMarks}</span></div>
            ${extra}
          </div>`;
        })
        .join('');

      A.openDialog({
        title: r.exam.title,
        wide: true,
        body: `
          <div class="score-banner">
            <div class="big">${r.totalScore} / ${r.maxScore}</div>
            <div>${r.percentage}%<br />
              <span class="muted small">Correct ${r.correctCount} · Wrong ${r.wrongCount} · Skipped ${r.unansweredCount} · Time ${A.minutesAndSeconds(r.timeTakenSeconds)}</span></div>
          </div>
          ${lines}`,
        buttons: [
          { label: 'Close', tone: 'btn-quiet' },
          { label: 'Download PDF', onClick: () => downloadPdf(resultId) },
        ],
      });
    } catch (error) {
      A.showError(error);
    }
  }

  async function downloadPdf(resultId) {
    try {
      await A.download(`/results/${resultId}/pdf`, 'result.pdf');
    } catch (error) {
      A.showError(error);
    }
  }

  async function showLeaderboard(examId) {
    try {
      const { data } = await A.api(`/exams/${examId}/leaderboard?limit=20`);
      const rows = data.rows
        .map((r) => `<tr ${r.isMe ? 'style="background:var(--brand-soft);font-weight:600"' : ''}>
          <td>${r.rank}</td><td>${esc(r.student?.fullName || '—')}${r.isMe ? ' (you)' : ''}</td>
          <td>${r.bestScore}</td><td>${r.bestPercentage}%</td><td>${A.minutesAndSeconds(r.timeTakenSeconds)}</td></tr>`)
        .join('');
      A.openDialog({
        title: `Leaderboard — ${data.exam.title}`,
        body: `<div class="table-wrap"><table class="grid">
          <thead><tr><th>Rank</th><th>Student</th><th>Best score</th><th>%</th><th>Time</th></tr></thead>
          <tbody>${rows || '<tr><td class="empty" colspan="5">No entries yet.</td></tr>'}</tbody></table></div>`,
        buttons: [{ label: 'Close', tone: 'btn-quiet' }],
      });
    } catch (error) {
      A.showError(error);
    }
  }

  ['score-rows', 'history-rows'].forEach((id) =>
    $(id).addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.viewResult) showResult(btn.dataset.viewResult);
      if (btn.dataset.pdf) downloadPdf(btn.dataset.pdf);
      if (btn.dataset.board) showLeaderboard(btn.dataset.board);
    })
  );

  const loaders = { exams: loadExams, scores: loadScores, history: loadHistory };
  A.wireSideMenu((view) => loaders[view]());
  loadExams();
})();
