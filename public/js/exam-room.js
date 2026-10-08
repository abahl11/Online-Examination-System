(function () {
  const A = window.TestDesk;
  if (!A.guardPage('student')) return;

  const $ = (id) => document.getElementById(id);
  const { esc } = A;

  const attemptId = new URLSearchParams(window.location.search).get('attempt');
  if (!attemptId) {
    window.location.replace('/student.html');
    return;
  }

  let questions = [];
  let current = 0;
  let endsAt = 0;
  let ticker = null;
  let finished = false;
  const answers = new Map();
  const unsavedCode = new Set();

  const isAnswered = (q) => {
    const a = answers.get(q._id);
    if (!a) return false;
    return q.kind === 'mcq' ? Boolean(a.selectedOption) : Boolean((a.codeAnswer || '').trim());
  };

  function setSaveState(text) {
    const slot = document.querySelector('.save-state');
    if (slot) slot.textContent = text;
  }

  async function saveAnswer(q) {
    const a = answers.get(q._id) || {};
    const body = q.kind === 'mcq' ? { question: q._id, selectedOption: a.selectedOption || null } : { question: q._id, codeAnswer: a.codeAnswer || '' };
    setSaveState('Saving…');
    try {
      await A.api(`/attempts/${attemptId}/answers`, { method: 'PUT', body });
      unsavedCode.delete(q._id);
      setSaveState(`Saved at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      if (error.code === 'TIME_UP' || error.status === 409) return showDone(error.message);
      setSaveState('Not saved — will retry when you move on');
      A.showError(error);
    }
  }

  const saveCodeSoon = A.debounce((q) => saveAnswer(q), 1200);

  function flushCode() {
    const q = questions[current];
    if (q && unsavedCode.has(q._id)) saveAnswer(q);
  }

  function drawPalette() {
    $('palette').innerHTML = questions
      .map((q, i) => `<button type="button" data-go="${i}" class="${isAnswered(q) ? 'done' : ''} ${i === current ? 'here' : ''}">${i + 1}</button>`)
      .join('');
  }

  function drawQuestion() {
    const q = questions[current];
    const a = answers.get(q._id) || {};
    let answerArea;

    if (q.kind === 'mcq') {
      answerArea = q.options
        .map((opt) => `<label class="choice ${a.selectedOption === opt._id ? 'picked' : ''}">
            <input type="radio" name="choice" value="${opt._id}" ${a.selectedOption === opt._id ? 'checked' : ''} />
            <span>${esc(opt.text)}</span>
          </label>`)
        .join('');
      answerArea += `<button type="button" class="btn btn-quiet btn-sm" id="clear-choice">Clear my answer</button>`;
    } else {
      const code = a.codeAnswer || '';
      answerArea = `
        <div class="muted small" style="margin-bottom:.3rem">Language: ${esc(q.language || 'any')} · reviewed by your instructor</div>
        <textarea class="code" id="code-box" spellcheck="false">${esc(code)}</textarea>`;
    }

    $('question-pane').innerHTML = `
      <div class="view-head">
        <h3>Question ${current + 1} of ${questions.length}</h3>
        <span class="badge info">${q.marks} mark(s)${q.kind === 'coding' ? ' · coding' : ''}</span>
      </div>
      <p style="white-space:pre-wrap">${esc(q.prompt)}</p>
      <div>${answerArea}</div>
      <div class="q-foot">
        <button type="button" class="btn btn-quiet" id="prev-btn" ${current === 0 ? 'disabled' : ''}>&larr; Previous</button>
        <span class="save-state"></span>
        <button type="button" class="btn btn-quiet" id="next-btn" ${current === questions.length - 1 ? 'disabled' : ''}>Next &rarr;</button>
      </div>`;

    drawPalette();
    wireQuestion(q);
  }

  function wireQuestion(q) {
    $('prev-btn').addEventListener('click', () => goTo(current - 1));
    $('next-btn').addEventListener('click', () => goTo(current + 1));

    if (q.kind === 'mcq') {
      $('question-pane').querySelectorAll('input[name="choice"]').forEach((radio) =>
        radio.addEventListener('change', () => {
          answers.set(q._id, { selectedOption: radio.value });
          $('question-pane').querySelectorAll('.choice').forEach((c) => c.classList.toggle('picked', c.contains(radio)));
          drawPalette();
          saveAnswer(q);
        })
      );
      $('clear-choice').addEventListener('click', () => {
        answers.set(q._id, { selectedOption: null });
        drawQuestion();
        saveAnswer(q);
      });
    } else {
      const box = $('code-box');
      box.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        const { selectionStart: s, selectionEnd: end } = box;
        box.value = `${box.value.slice(0, s)}  ${box.value.slice(end)}`;
        box.selectionStart = box.selectionEnd = s + 2;
        box.dispatchEvent(new Event('input'));
      });
      box.addEventListener('input', () => {
        answers.set(q._id, { codeAnswer: box.value });
        unsavedCode.add(q._id);
        setSaveState('Typing…');
        drawPalette();
        saveCodeSoon(q);
      });
    }
  }

  function goTo(index) {
    if (index < 0 || index >= questions.length) return;
    flushCode();
    current = index;
    drawQuestion();
  }

  $('palette').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]');
    if (btn) goTo(Number(btn.dataset.go));
  });

  function tick() {
    const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    const timer = $('timer');
    const h = Math.floor(left / 3600);
    const m = Math.floor((left % 3600) / 60);
    const s = left % 60;
    timer.textContent = `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    timer.classList.toggle('low', left <= 60);
    if (left === 0) submitAttempt(true);
  }

  async function submitAttempt(auto) {
    if (finished) return;
    finished = true;
    clearInterval(ticker);
    $('submit-btn').disabled = true;

    const payload = questions
      .filter((q) => answers.has(q._id))
      .map((q) => {
        const a = answers.get(q._id);
        return q.kind === 'mcq' ? { question: q._id, selectedOption: a.selectedOption || null } : { question: q._id, codeAnswer: a.codeAnswer || '' };
      });

    try {
      const { data } = await A.api(`/attempts/${attemptId}/submit`, { method: 'POST', body: { answers: payload, auto } });
      showDone(auto ? 'Time is up — your answers were submitted automatically.' : 'Your answers have been submitted.', data);
    } catch (error) {
      finished = false;
      $('submit-btn').disabled = false;
      A.showError(error);
    }
  }

  $('submit-btn').addEventListener('click', async () => {
    flushCode();
    const skipped = questions.filter((q) => !isAnswered(q)).length;
    const message = skipped
      ? `You have ${skipped} unanswered question(s). Submit anyway? You cannot change answers afterwards.`
      : 'Submit your exam now? You cannot change answers afterwards.';
    if (await A.confirmAction(message, 'Submit')) submitAttempt(false);
  });

  function showDone(message, summary) {
    finished = true;
    clearInterval(ticker);
    $('room').classList.add('hidden');
    $('timer').classList.add('hidden');
    $('submit-btn').classList.add('hidden');
    $('done').classList.remove('hidden');
    $('done-text').textContent = message;
    $('done-score').innerHTML =
      summary && summary.score
        ? `<div class="score-banner" style="justify-content:center"><div class="big">${summary.score.total} / ${summary.score.max}</div><div>${summary.score.percentage}%</div></div>`
        : '<p>Your score will appear under <strong>My scores</strong> once your instructor publishes the results.</p>';
  }

  window.addEventListener('beforeunload', (e) => {
    if (finished) return;
    flushCode();
    e.preventDefault();
    e.returnValue = '';
  });

  async function boot() {
    try {
      const { data } = await A.api(`/attempts/${attemptId}`);
      $('room-title').textContent = data.exam?.title || 'Exam';
      document.title = `TestDesk · ${data.exam?.title || 'Exam'}`;

      if (data.status !== 'in_progress') {
        showDone('This attempt has already been submitted.');
        return;
      }

      questions = data.questions;
      questions.forEach((q) => {
        if (q.answer) answers.set(q._id, { selectedOption: q.answer.selectedOption, codeAnswer: q.answer.codeAnswer });
      });

      endsAt = Date.now() + data.secondsLeft * 1000;
      $('room').classList.remove('hidden');
      $('timer').classList.remove('hidden');
      $('submit-btn').classList.remove('hidden');
      drawQuestion();
      tick();
      ticker = setInterval(tick, 1000);
    } catch (error) {
      A.showError(error);
      $('room-title').textContent = 'Could not load this exam';
    }
  }

  boot();
})();
