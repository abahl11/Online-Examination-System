const PDFDocument = require('pdfkit');

const INK = '#1f2937';
const MUTED = '#6b7280';
const ACCENT = '#4338ca';

const OUTCOME_LABEL = {
  correct: 'Correct',
  wrong: 'Wrong',
  unanswered: 'Not answered',
  pending: 'Awaiting review',
  reviewed: 'Reviewed',
};

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function writeResultPdf(output, { result, exam, course, student, attemptNumber }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(output);

  doc.rect(0, 0, doc.page.width, 80).fill(ACCENT);
  doc.fillColor('#ffffff').fontSize(22).text('TestDesk', 50, 25);
  doc.fontSize(11).text('Official result sheet', 50, 52);
  doc.moveDown(3);

  const detail = (label, value) => {
    doc.fillColor(MUTED).fontSize(10).text(label, { continued: true });
    doc.fillColor(INK).text(`  ${value}`);
  };
  doc.fillColor(INK).fontSize(16).text(exam.title, 50, 100);
  doc.moveDown(0.5);
  detail('Course:', course ? `${course.title} (${course.code})` : '-');
  detail('Student:', `${student.fullName} <${student.email}>`);
  detail('Attempt:', `#${attemptNumber}`);
  detail('Submitted:', new Date(result.createdAt).toLocaleString('en-GB'));
  detail('Time taken:', formatDuration(result.timeTakenSeconds));
  doc.moveDown();

  doc.fillColor(INK).fontSize(14).text(`Score: ${result.totalScore} / ${result.maxScore}   (${result.percentage}%)`);
  doc.fontSize(12);
  doc.text(`MCQ: ${result.mcqScore}   Coding: ${result.codingScore}`);
  doc.text(
    `Correct: ${result.correctCount}   Wrong: ${result.wrongCount}   Not answered: ${result.unansweredCount}`
  );
  doc.text(`Negative marking: ${exam.negativeMark} per wrong MCQ`);
  doc.moveDown();

  doc.fillColor(ACCENT).fontSize(13).text('Question breakdown');
  doc.moveDown(0.4);
  result.lines.forEach((line, index) => {
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.fillColor(INK).fontSize(10.5).text(`${index + 1}. ${line.prompt}`);
    const parts = [
      `${OUTCOME_LABEL[line.outcome] || line.outcome}`,
      `${line.marksAwarded} / ${line.maxMarks} marks`,
    ];
    if (line.kind === 'mcq') {
      parts.push(`Your answer: ${line.selectedText || '-'}`);
      parts.push(`Correct: ${line.correctText || '-'}`);
    }
    doc.fillColor(MUTED).fontSize(9).text(parts.join('   |   '));
    if (line.feedback) doc.text(`Feedback: ${line.feedback}`);
    doc.moveDown(0.5);
  });

  doc.fillColor(MUTED).fontSize(8).text(`Generated on ${new Date().toLocaleString('en-GB')}`, 50, doc.page.height - 60);
  doc.end();
}

module.exports = { writeResultPdf };
