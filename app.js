const state = {
  activeView: 'daily',
  modal: null,
  clarityStep: 1,
  actionCompleted: false,
  checkin: { clarity: 3, energy: 4, stress: 3 },
};

const evidence = {
  'daily-theme': { sources: [['命理周期依据', '当前流月处于由收拢转向行动的交界，先观察后判断。'], ['近期状态依据', '过去 7 天有 3 次在等待回复时重复搜索。'], ['当前现实依据', '今天的重点事件是等待一条工作相关的回应。']], synthesis: '综合来看，今天最有价值的不是快速下结论，而是把“没有信息”与“坏结果”分开。', confidence: '中 · 仍有信息缺口' },
  'daily-action': { sources: [['现实事实', '行动直接对应今天的等待和模糊回应。'], ['历史反馈', '你之前完成“收集事实”后，清晰度平均上升 0.6。']], synthesis: '这是一个 15 分钟内可验证、不会锁死后续选择的小动作。', confidence: '高 · 行动边界清晰' },
  clarity: { sources: [['已经发生', '你输入的消息目前没有截止时间或明确要求。'], ['风险判断', '暂未出现需要立即处理的高风险信号。'], ['用户解释', '“对方不愿明说”是当前解释，不等同于事实。']], synthesis: '先离开界面可以降低即时反应，把需要确认的问题变得更具体。', confidence: '中 · 建议随新信息更新' },
  journey: { sources: [['当前章节', '你的章节状态仍是“探索中”，而不是“准备决定”。'], ['现实约束', '现金储备和精力是会影响换轨质量的关键条件。']], synthesis: '把选择拆成可验证条件，可以减少把情绪直接变成最终决定。', confidence: '中 · 等待外部信息' },
  'year-quarter': { sources: [['年度背景', '年度主线是先重建结构，再选择扩张。'], ['章节背景', '当前工作章节正在验证替代路径的真实性。'], ['已知计划', '8—10 月有机会进行小范围、可逆的外部试探。']], synthesis: 'Q3 的重点不是“必须改变”，而是让已经成熟的判断进入一次低风险试行。', confidence: '中 · 需要现实事件验证' },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setView(view) {
  state.activeView = view;
  $$('.view').forEach((item) => item.classList.toggle('active', item.id === `view-${view}`));
  $$('.nav-item, .mobile-nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message) {
  $('#toast-message').textContent = message;
  $('#toast').classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => $('#toast').classList.remove('show'), 2600);
}

function openModal(id) {
  state.modal = id;
  $('#modal-backdrop').hidden = false;
  $$('.modal').forEach((modal) => { modal.hidden = modal.id !== id; });
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  state.modal = null;
  $('#modal-backdrop').hidden = true;
  $$('.modal').forEach((modal) => { modal.hidden = true; });
  document.body.style.overflow = '';
}

function renderEvidence(container) {
  const data = evidence[container.dataset.evidence];
  if (!data) return;
  container.querySelector('.evidence-body').innerHTML = `
    <div class="evidence-body-grid">${data.sources.map(([title, text]) => `<div class="evidence-source"><strong>${title}</strong><span>${text}</span></div>`).join('')}</div>
    <p class="evidence-synthesis">${data.synthesis}</p>
    <div class="evidence-meta"><span>可信度</span><span>${data.confidence}</span></div>`;
}

function bindEvidence() {
  $$('.evidence-inline').forEach((container) => {
    renderEvidence(container);
    container.querySelector('.evidence-toggle').addEventListener('click', () => {
      const willOpen = !container.classList.contains('open');
      container.classList.toggle('open', willOpen);
      if (willOpen) showToast('已展开结构化证据链');
    });
  });
}

function updateClarityStep(step) {
  state.clarityStep = step;
  $$('.modal-step').forEach((item) => item.classList.toggle('active', item.dataset.step === String(step)));
  $$('.modal-progress span').forEach((item, index) => item.classList.toggle('active', index < step));
}

function updateRange(id) {
  const input = $(`#${id}`);
  const output = $(`#${id}-output`);
  if (input && output) output.value = input.value;
}

function init() {
  $$('.nav-item, .mobile-nav-item').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.view) setView(button.dataset.view);
  }));
  $$('[data-view-target]').forEach((button) => button.addEventListener('click', () => {
    setView(button.dataset.viewTarget);
    if (button.dataset.scroll === 'mirror') window.setTimeout(() => showToast('七日镜像将在这里展开'), 300);
  }));

  ['#open-clarity', '#open-clarity-2', '#mobile-clarity'].forEach((selector) => $(selector)?.addEventListener('click', () => { updateClarityStep(1); openModal('clarity-modal'); }));
  ['#open-onboarding', '#mobile-profile'].forEach((selector) => $(selector)?.addEventListener('click', () => openModal('onboarding-modal')));
  $('#open-safety')?.addEventListener('click', () => openModal('safety-modal'));
  $('#open-checkin')?.addEventListener('click', () => openModal('checkin-modal'));
  $('#modal-backdrop').addEventListener('click', closeModal);
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  $$('.modal-close').forEach((button) => button.addEventListener('click', closeModal));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.modal) closeModal(); });

  $$('[data-next-step]').forEach((button) => button.addEventListener('click', () => {
    if (state.clarityStep === 1 && !$('#clarity-input').value.trim()) {
      $('#clarity-input').focus();
      showToast('先写下一件刚刚发生的事');
      return;
    }
    updateClarityStep(Math.min(3, state.clarityStep + 1));
  }));
  $$('.emotion-grid button').forEach((button) => button.addEventListener('click', () => {
    $$('.emotion-grid button').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
  }));
  $$('.interest-grid button, .style-options button').forEach((button) => button.addEventListener('click', () => {
    button.parentElement.querySelectorAll('button').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
  }));

  ['clarity', 'energy', 'stress'].forEach((key) => $(`#checkin-${key}`)?.addEventListener('input', () => updateRange(`checkin-${key}`)));
  $('#save-checkin')?.addEventListener('click', () => {
    state.checkin = { clarity: Number($('#checkin-clarity').value), energy: Number($('#checkin-energy').value), stress: Number($('#checkin-stress').value) };
    const score = (state.checkin.clarity + state.checkin.energy - state.checkin.stress + 5) / 3;
    $('#clarity-score').textContent = score.toFixed(1);
    closeModal();
    showToast('今天的状态已更新');
  });
  $('#complete-action')?.addEventListener('click', () => {
    state.actionCompleted = !state.actionCompleted;
    const button = $('#complete-action');
    button.classList.toggle('completed', state.actionCompleted);
    $('.button-label', button).textContent = state.actionCompleted ? '今天已完成' : '完成这一步';
    button.querySelector('.button-icon').textContent = state.actionCompleted ? '✓' : '→';
    showToast(state.actionCompleted ? '很好，这一步已经留下记录' : '已恢复为待完成');
  });
  $('#chapter-action')?.addEventListener('click', () => showToast('章节进展已记录'));
  $('#open-chapter-log')?.addEventListener('click', () => showToast('记录编辑器将在下一步接入'));
  $('#add-chapter')?.addEventListener('click', () => showToast('新建章节表单将在下一步接入'));
  $('#add-year-event')?.addEventListener('click', () => showToast('现实事件更新入口已预留'));
  $('#compare-year')?.addEventListener('click', () => showToast('当前版本：01 · 尚未发生静默覆盖'));
  bindEvidence();
}

init();
