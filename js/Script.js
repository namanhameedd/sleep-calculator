// js/script.js
document.addEventListener('DOMContentLoaded', () => {
  // -----------------------
  // Element refs
  // -----------------------
  const hourSelect = document.getElementById('hour');
  const minuteSelect = document.getElementById('minute');
  const ampmSelect = document.getElementById('ampm');
  const radioBtns = document.querySelectorAll('.radio-btn');
  const ageButtons = document.querySelectorAll('.age-buttons button');
  const calculateBtn = document.getElementById('calculate');
  const resultsEl = document.getElementById('results');
  const recommendedEl = document.getElementById('recommended');
  const specialNoteEl = document.getElementById('specialNote');
  const goBackWrap = document.getElementById('goBackWrap');
  const goBackBtn = document.getElementById('goBack');
  const calculatorCard = document.querySelector('.calculator-card');
  const themeToggle = document.getElementById('themeToggle');
  const openChart = document.getElementById('openChart');

  // Modal elements
  const modal = document.getElementById('sleepChartModal');
  const modalOverlay = document.getElementById('modalOverlay');
  const closeModal = document.getElementById('closeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // -----------------------
  // Config / data
  // -----------------------
  const fallAsleep = 15; // minutes assumed to fall asleep
  // sleep recommendations (min, max hours)
  const sleepRecommendations = [
    { range: "0-3 Months", min: 14, max: 17 },
    { range: "4-11 Months", min: 12, max: 15 },
    { range: "1-2 Years", min: 11, max: 14 },
    { range: "3-5 Years", min: 10, max: 13 },
    { range: "6-13 Years", min: 9,  max: 11 },
    { range: "14-17 Years", min: 8,  max: 10 },
    { range: "18-25 Years", min: 7,  max: 9 },
    { range: "26-35 Years", min: 7,  max: 9 },
    { range: "36-45 Years", min: 7,  max: 9 },
    { range: "46-55 Years", min: 7,  max: 9 },
    { range: "56-64 Years", min: 7,  max: 8 },
    { range: "65+ Years",  min: 7,  max: 8 }
  ];

  // -----------------------
  // Populate time selects
  // -----------------------
  for (let h = 1; h <= 12; h++) {
    hourSelect.innerHTML += `<option value="${h}">${h}</option>`;
  }
  for (let m = 0; m < 60; m += 5) {
    const val = String(m).padStart(2, '0');
    minuteSelect.innerHTML += `<option value="${val}">${val}</option>`;
  }

  // -----------------------
  // Radio-like behaviour for labels
  // -----------------------
  radioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      radioBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const input = btn.querySelector('input[type="radio"]');
      if (input) input.checked = true;
    });
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); } });
  });

  // -----------------------
  // Age button behaviour
  // -----------------------
  let selectedAgeLabel = null;
  ageButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      ageButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAgeLabel = btn.textContent.trim();
    });
  });

  // -----------------------
  // Helpers: time conversions
  // -----------------------
  function toMinutesFromHM(h, m, ampm) {
    let hour = parseInt(h, 10);
    const minute = parseInt(m, 10);
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  function minutesToHM(mins) {
    // Normalize within 0..1439
    mins = ((mins % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = ((h + 11) % 12) + 1;
    return { h24: h, hour12, minute: m, ampm };
  }

  function formatTimeObj(obj) {
    return `${String(obj.hour12).padStart(2, '0')}:${String(obj.minute).padStart(2, '0')} ${obj.ampm}`;
  }

  // Find age info object by checking if the button text contains the range starting token
  function findAgeInfoFromLabel(label) {
    if (!label) return null;
    for (const info of sleepRecommendations) {
      // match on the numeric portion (like "0-3" or "65+")
      const token = info.range.split(' ')[0];
      if (label.includes(token)) return info;
    }
    return null;
  }

  // For infants use ~50 min cycles, otherwise 90
  function cycleLengthForAge(info) {
    if (!info) return 90;
    if (info.range.includes('Months') || info.range.startsWith('1-2')) return 50;
    return 90;
  }

  // Calculate target hours (midpoint rounded to 0.5)
  function targetHoursFromInfo(info) {
    if (!info) return 8;
    const midpoint = (info.min + info.max) / 2;
    return Math.round(midpoint * 2) / 2;
  }

  // -----------------------
  // Render recommended top text
  // -----------------------
  function renderRecommendedText(ageInfo) {
    if (!ageInfo) {
      recommendedEl.innerHTML = '';
      recommendedEl.classList.add('hidden');
      return;
    }
    // add spacing before recommended block so it doesn't sit too close to calculator area
    recommendedEl.innerHTML = `
      <div style="margin-top:24px; text-align:center; color:var(--accent); font-weight:600;">
        Recommended Sleep Duration for ${ageInfo.range}: ${ageInfo.min}–${ageInfo.max} hours per night
      </div>
    `;
    recommendedEl.classList.remove('hidden');
  }

  // -----------------------
  // Render result cards (age-aware)
  // -----------------------
  function renderResultCards(mode, baseMinutes) {
    // Determine age info
    const ageInfo = findAgeInfoFromLabel(selectedAgeLabel);
    const cycleLen = cycleLengthForAge(ageInfo);
    const targetHours = targetHoursFromInfo(ageInfo);
    const desiredMinutes = Math.round(targetHours * 60);

    // ideal cycles approximating target
    const idealCycles = Math.max(1, Math.round((desiredMinutes - fallAsleep) / cycleLen));
    const cyclesList = [idealCycles, Math.max(1, idealCycles - 1), idealCycles + 1];

    const cards = cyclesList.map(cycles => {
      let t, durationMin;
      if (mode === 'wake') {
        durationMin = cycles * cycleLen + fallAsleep;
        t = baseMinutes - durationMin;
      } else { // sleep -> wake times
        durationMin = cycles * cycleLen;
        t = baseMinutes + durationMin;
      }
      const timeObj = minutesToHM(t);
      const durationText = `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;
      return {
        label: (mode === 'wake' ? 'Go to sleep at' : 'Recommended wake time'),
        time: formatTimeObj(timeObj),
        cycles,
        durationText,
        durationMin
      };
    });

    // build DOM
    resultsEl.innerHTML = `
      <h3 style="margin:0 0 6px;text-align:center;color:var(--text)">Results</h3>
      <p style="text-align:center;color:var(--muted);max-width:820px;margin:0px auto 12px;font-size:14px;">
        It typically takes ${fallAsleep} minutes to fall asleep. Below are recommended times based on sleep cycles and age guidance.
      </p>
    `;

    const row = document.createElement('div');
    row.className = 'result-row';
    cards.forEach(card => {
      const cardEl = document.createElement('article');
      cardEl.className = 'result-card';
      cardEl.innerHTML = `
        <div class="result-top">
          <div class="col">
            <div class="small">${card.label}</div>
            <div class="result-time">${card.time}</div>
          </div>
          <div class="dash">· · ·</div>
          <div class="col" style="text-align:right;">
            <div class="small">${card.cycles} Sleep Cycles</div>
            <div class="result-time" style="font-size:16px; font-weight:700;">${card.durationText}</div>
          </div>
        </div>
        <div class="result-bottom">${card.durationText} Hours in Bed (${card.cycles} Sleep Cycles)</div>
      `;
      row.appendChild(cardEl);
    });
    resultsEl.appendChild(row);

    // special note (styled)
    const note = document.createElement('div');
    note.style.maxWidth = '820px';
    note.style.margin = '12px auto';
    note.style.padding = '10px 14px';
    note.style.borderRadius = '10px';
    note.style.textAlign = 'center';
    note.style.fontSize = '14px';
    note.style.background = 'var(--panel-bg)';
    note.style.border = '1px solid var(--border)';
    note.innerHTML = `
      <strong style="color:var(--accent-2)">💡 Special Note:</strong><br>
      If you wake up at one of these times, you’ll rise in between ${cycleLen}-minute sleep cycles.
      A good night’s sleep for your age is approximately <strong>${ageInfo ? ageInfo.min + '–' + ageInfo.max : '7–9'} hours</strong>.
    `;
    resultsEl.appendChild(note);

    // suggestion line (pick idealCycles if present)
    const recommended = cards.find(c => c.cycles === idealCycles) || cards[Math.floor(cards.length / 2)];
    const suggestion = document.createElement('div');
    suggestion.style.maxWidth = '820px';
    suggestion.style.marginTop = '6px';
    suggestion.style.textAlign = 'center';
    suggestion.style.color = 'var(--muted)';
    suggestion.innerHTML = `
      <strong>Suggestion:</strong> For best rest, aim for around <strong>${Math.round(recommended.durationMin / 60)}h ${recommended.durationMin % 60}m</strong>
      (about <strong>${recommended.cycles} sleep cycles</strong>). Example: <strong>${recommended.time}</strong>.
    `;
    resultsEl.appendChild(suggestion);

    // show UI
    resultsEl.classList.remove('hidden');
    specialNoteEl.classList.remove('hidden');
    goBackWrap.classList.remove('hidden');
    calculatorCard.classList.remove('collapsed');
    calculatorCard.classList.add('expanded');
    openChart.classList.remove('hidden');

    // smooth scroll a touch after DOM update
    setTimeout(() => resultsEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }

  // -----------------------
  // Calculate button listener (validated)
  // -----------------------
  calculateBtn.addEventListener('click', () => {
    if (!selectedAgeLabel) {
      // visual highlight + alert
      const ageSection = document.querySelector('.age-range');
      ageSection.classList.add('highlight');
      setTimeout(() => ageSection.classList.remove('highlight'), 2200);
      alert('Please select your age range before calculating.');
      return;
    }

    const selectedMode = document.querySelector('input[name="mode"]:checked')?.value || 'wake';
    const h = hourSelect.value;
    const m = minuteSelect.value;
    const ap = ampmSelect.value;

    // render recommended text above results
    const ageInfo = findAgeInfoFromLabel(selectedAgeLabel);
    renderRecommendedText(ageInfo);

    // hide previous then render new
    resultsEl.classList.add('hidden');
    specialNoteEl.classList.add('hidden');
    goBackWrap.classList.add('hidden');
    openChart.classList.add('hidden');

    setTimeout(() => {
      const baseMin = toMinutesFromHM(h, m, ap);
      renderResultCards(selectedMode, baseMin);
    }, 80);
  });

  // -----------------------
  // Go back behavior
  // -----------------------
  goBackBtn.addEventListener('click', () => {
    resultsEl.classList.add('hidden');
    recommendedEl.classList.add('hidden');
    specialNoteEl.classList.add('hidden');
    goBackWrap.classList.add('hidden');
    openChart.classList.add('hidden');
    calculatorCard.classList.remove('expanded');
    calculatorCard.classList.add('collapsed');

    // focus first control for accessibility
    const firstRadioInput = document.querySelector('.radio-btn input');
    if (firstRadioInput) firstRadioInput.focus();
  });

  // -----------------------
  // Modal (Chart) handlers
  // -----------------------
  function openModal() { modal.classList.remove('hidden'); }
  function hideModal() { modal.classList.add('hidden'); }

  openChart?.addEventListener('click', openModal);
  modalOverlay?.addEventListener('click', hideModal);
  closeModal?.addEventListener('click', hideModal);
  closeModalBtn?.addEventListener('click', hideModal);

  // -----------------------
  // Theme toggle
  // -----------------------
  // Apply saved theme on load
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') document.body.classList.add('dark');
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    // update icon text
    themeToggle.textContent = document.body.classList.contains('dark') ? '🌞' : '🌙';
  });
  // ensure icon initial state
  themeToggle.textContent = document.body.classList.contains('dark') ? '🌞' : '🌙';

  // -----------------------
  // Accessibility: keyboard to close modal with Esc
  // -----------------------
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      hideModal();
    }
  });
});
