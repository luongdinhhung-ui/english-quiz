// 英語クイズ — plain JS, no build step.

const SESSION_SIZE = 10;
const REVIEW_CLEAR = 2; // correct answers in a row needed to leave まちがえた問題
const STORE_KEY = 'eq-progress-v1';

const TYPES = {
  vocab_ej: { category: 'vocab', label: '意味を選ぼう' },
  vocab_je: { category: 'vocab', label: '英語で書こう' },
  grammar:  { category: 'grammar', label: '( ) に入る語句を選ぼう' },
  order:    { category: 'order', label: '正しい順に並べよう' },
};

const $ = (id) => document.getElementById(id);

// ---------- CSV ----------
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function splitOrder(answer) {
  const m = answer.trim().match(/^(.*?)([.?!]?)$/);
  return { words: m[1].trim().split(/\s+/), punct: m[2] };
}

function validate(q) {
  if (!TYPES[q.type]) return 'type が不正です';
  if (!q.topic || !q.question || !q.answer) return 'topic / question / answer が空です';
  if (q.type === 'vocab_ej' || q.type === 'grammar') {
    if (q.choices.length < 2) return 'choices が足りません';
    if (!q.choices.includes(q.answer)) return 'answer が choices の中にありません';
  }
  if (q.type === 'order' && splitOrder(q.answer).words.length < 2) return '並べ替えの answer が短すぎます';
  return null;
}

async function loadQuestions() {
  const res = await fetch('questions.csv', { cache: 'no-cache' });
  const rows = parseCSV(await res.text());
  const header = rows[0].map((h) => h.trim());
  const col = (r, name) => (r[header.indexOf(name)] || '').trim();
  const questions = [], warnings = [];
  rows.slice(1).forEach((r, i) => {
    if (r.every((f) => f.trim() === '')) return;
    const q = {
      type: col(r, 'type'),
      topic: col(r, 'topic'),
      question: col(r, 'question'),
      choices: col(r, 'choices').split('|').map((s) => s.trim()).filter(Boolean),
      answer: col(r, 'answer'),
      explanation: col(r, 'explanation'),
    };
    const err = validate(q);
    if (err) { warnings.push(`⚠ CSV ${i + 2}行目をスキップしました（${err}）`); return; }
    q.id = q.type + '|' + q.question;
    questions.push(q);
  });
  return { questions, warnings };
}

// ---------- progress (localStorage) ----------
function freshProgress() { return { mistakes: {}, topics: {}, streak: { last: null, count: 0 } }; }
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || freshProgress(); }
  catch { return freshProgress(); }
}
function saveProgress() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ }
}
function dayStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function today() { return dayStr(new Date()); }
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return dayStr(d); }

function currentStreak() {
  const s = progress.streak;
  return s.last === today() || s.last === yesterday() ? s.count : 0;
}

function record(q, correct) {
  const t = progress.topics[q.topic] || (progress.topics[q.topic] = { correct: 0, total: 0 });
  t.total++;
  if (correct) t.correct++;

  if (!correct) progress.mistakes[q.id] = 0;
  else if (q.id in progress.mistakes) {
    progress.mistakes[q.id]++;
    if (progress.mistakes[q.id] >= REVIEW_CLEAR) delete progress.mistakes[q.id];
  }

  const s = progress.streak;
  if (s.last !== today()) {
    s.count = s.last === yesterday() ? s.count + 1 : 1;
    s.last = today();
  }
  saveProgress();
}

// ---------- helpers ----------
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function show(id) {
  for (const s of ['home', 'quiz', 'result']) $(s).hidden = s !== id;
  window.scrollTo(0, 0);
}
function el(tag, props = {}, text) {
  const e = Object.assign(document.createElement(tag), props);
  if (text !== undefined) e.textContent = text;
  return e;
}

// ---------- home ----------
function poolFor(category, topic) {
  return QUESTIONS.filter((q) =>
    (category === 'mix' || TYPES[q.type].category === category) &&
    (topic === 'all' || q.topic === topic));
}

function renderTopics() {
  const category = $('type-select').value;
  const topics = [...new Set(poolFor(category, 'all').map((q) => q.topic))];
  const sel = $('topic-select');
  sel.replaceChildren(el('option', { value: 'all' }, 'すべて'),
    ...topics.map((t) => el('option', { value: t }, t)));
}

function renderHome() {
  $('streak').textContent = currentStreak();
  $('total-correct').textContent = Object.values(progress.topics).reduce((n, t) => n + t.correct, 0);
  const reviewable = reviewPool().length;
  $('review-count').textContent = reviewable;
  $('review-btn').disabled = reviewable === 0;

  const rows = Object.entries(progress.topics).map(([topic, t]) => {
    const tr = el('tr');
    tr.append(el('td', {}, topic), el('td', {}, `${Math.round(100 * t.correct / t.total)}%（${t.correct}/${t.total}）`));
    return tr;
  });
  if (!rows.length) {
    const tr = el('tr');
    tr.append(el('td', { className: 'muted' }, 'まだ記録がありません'));
    rows.push(tr);
  }
  $('topic-stats').replaceChildren(...rows);
  show('home');
}

// ---------- quiz ----------
let session = null;

function reviewPool() { return QUESTIONS.filter((q) => q.id in progress.mistakes); }

function startSession(pool, isReview = false) {
  const questions = shuffle(pool).slice(0, SESSION_SIZE);
  session = { questions, index: 0, score: 0, pool, isReview };
  renderQuestion();
  show('quiz');
}

function renderQuestion() {
  const q = session.questions[session.index];
  $('progress').textContent = `${session.index + 1} / ${session.questions.length}`;
  $('prompt-label').textContent = TYPES[q.type].label;
  $('prompt').textContent = q.question;
  $('feedback').hidden = true;
  const area = $('answer-area');
  area.replaceChildren();

  if (q.type === 'vocab_ej' || q.type === 'grammar') {
    for (const c of shuffle(q.choices)) {
      const b = el('button', { className: 'choice' }, c);
      b.onclick = () => {
        area.querySelectorAll('button').forEach((x) => {
          x.disabled = true;
          if (x.textContent === q.answer) x.classList.add('correct');
        });
        if (c !== q.answer) b.classList.add('wrong');
        finish(q, c === q.answer);
      };
      area.append(b);
    }
  } else if (q.type === 'vocab_je') {
    const input = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
    const b = el('button', { className: 'primary' }, '答える');
    const submit = () => {
      if (input.value.trim() === '') return;
      input.disabled = b.disabled = true;
      const norm = (s) => s.normalize('NFKC').trim().toLowerCase();
      finish(q, q.answer.split('/').some((a) => norm(a) === norm(input.value)));
    };
    b.onclick = submit;
    // preventDefault so the same Enter press doesn't also activate the focused 次へ button
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
    area.append(input, b);
    input.focus();
  } else {
    const { words, punct } = splitOrder(q.answer);
    let order = shuffle(words.map((w, i) => i));
    while (words.length > 1 && order.every((v, i) => words[v] === words[i])) order = shuffle(order);
    const built = el('div', { className: 'tiles' });
    const bank = el('div', { className: 'tiles' });
    const punctEl = el('span', { className: 'punct' }, punct);
    const check = el('button', { className: 'primary', disabled: true }, '答える');
    const refresh = () => {
      built.append(punctEl); // keep punctuation at the end
      check.disabled = bank.querySelectorAll('button').length > 0;
    };
    for (const i of order) {
      const t = el('button', {}, words[i]);
      t.onclick = () => {
        if (check.dataset.done) return;
        (t.parentNode === bank ? built : bank).append(t);
        refresh();
      };
      bank.append(t);
    }
    check.onclick = () => {
      check.dataset.done = '1';
      check.disabled = true;
      const got = [...built.querySelectorAll('button')].map((b) => b.textContent);
      finish(q, got.join(' ') === words.join(' '));
    };
    refresh();
    area.append(built, bank, check);
  }
}

function finish(q, correct) {
  record(q, correct);
  if (correct) session.score++;
  const r = $('feedback-result');
  r.textContent = correct ? '⭕ 正解！' : `❌ 不正解　正解：${q.type === 'vocab_je' ? q.answer.split('/').join(' / ') : q.answer}`;
  r.className = correct ? 'ok' : 'ng';
  $('feedback-expl').textContent = q.explanation;
  $('feedback').hidden = false;
  $('next-btn').focus();
}

function next() {
  session.index++;
  if (session.index < session.questions.length) return renderQuestion();
  $('score').textContent = `${session.score} / ${session.questions.length}`;
  show('result');
}

// ---------- boot ----------
let QUESTIONS = [];
let progress = loadProgress();

(async () => {
  try {
    const { questions, warnings } = await loadQuestions();
    QUESTIONS = questions;
    $('warnings').replaceChildren(...warnings.map((w) => el('div', { className: 'warning' }, w)));
  } catch {
    $('warnings').replaceChildren(el('div', { className: 'warning' }, '⚠ questions.csv を読み込めませんでした'));
  }

  $('type-select').onchange = renderTopics;
  $('start-btn').onclick = () => {
    const pool = poolFor($('type-select').value, $('topic-select').value);
    if (pool.length) startSession(pool);
  };
  $('review-btn').onclick = () => startSession(reviewPool(), true);
  $('reset-btn').onclick = () => {
    if (!confirm('すべての記録（正答率・連続日数・まちがえた問題）を消します。よろしいですか？')) return;
    progress = freshProgress();
    saveProgress();
    renderHome();
  };
  $('next-btn').onclick = next;
  $('quit-btn').onclick = renderHome;
  $('home-btn').onclick = renderHome;
  $('again-btn').onclick = () => {
    // review sessions re-read mistakes so cleared questions drop out
    const pool = session.isReview ? reviewPool() : session.pool;
    pool.length ? startSession(pool, session.isReview) : renderHome();
  };

  renderTopics();
  renderHome();
})();
