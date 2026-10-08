const round2 = (n) => Math.round(n * 100) / 100;

function markPaper(paper, answers, negativeMark = 0) {
  const answerFor = new Map(answers.map((a) => [String(a.question), a]));

  return paper.map((q) => {
    const given = answerFor.get(String(q._id));
    const line = {
      question: q._id,
      kind: q.kind,
      prompt: q.prompt,
      maxMarks: q.marks,
      marksAwarded: 0,
      outcome: 'unanswered',
      selectedOption: null,
      selectedText: '',
      correctText: '',
      codeAnswer: '',
      feedback: '',
    };

    if (q.kind === 'coding') {
      const code = (given?.codeAnswer || '').trim();
      if (code) {
        line.codeAnswer = given.codeAnswer;
        line.outcome = 'pending';
      }
      return line;
    }

    const correct = (q.options || []).find((opt) => opt.isCorrect);
    line.correctText = correct ? correct.text : '';

    if (!given || !given.selectedOption) return line;

    const picked = (q.options || []).find((opt) => String(opt._id) === String(given.selectedOption));
    line.selectedOption = given.selectedOption;
    line.selectedText = picked ? picked.text : '';

    if (correct && String(correct._id) === String(given.selectedOption)) {
      line.outcome = 'correct';
      line.marksAwarded = q.marks;
    } else {
      line.outcome = 'wrong';
      line.marksAwarded = -Math.abs(negativeMark);
    }
    return line;
  });
}

function summarise(lines) {
  let maxScore = 0;
  let mcqScore = 0;
  let codingScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let pendingCount = 0;

  for (const line of lines) {
    maxScore += line.maxMarks;
    if (line.kind === 'coding') codingScore += line.marksAwarded;
    else mcqScore += line.marksAwarded;

    if (line.outcome === 'correct') correctCount += 1;
    else if (line.outcome === 'wrong') wrongCount += 1;
    else if (line.outcome === 'unanswered') unansweredCount += 1;
    else if (line.outcome === 'pending') pendingCount += 1;
  }

  const totalScore = Math.max(0, round2(mcqScore + codingScore));
  const percentage = maxScore > 0 ? round2((totalScore / maxScore) * 100) : 0;

  return {
    maxScore: round2(maxScore),
    mcqScore: round2(mcqScore),
    codingScore: round2(codingScore),
    totalScore,
    percentage,
    correctCount,
    wrongCount,
    unansweredCount,
    reviewStatus: pendingCount > 0 ? 'pending' : lines.some((l) => l.outcome === 'reviewed') ? 'reviewed' : 'auto',
  };
}

module.exports = { markPaper, summarise, round2 };
