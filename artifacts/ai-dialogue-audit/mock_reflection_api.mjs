import http from 'node:http';

const headers = {
  'Access-Control-Allow-Origin': 'http://localhost:8081',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

function json(response, status, body) {
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

function evidence(payload) {
  const items = [
    { id: 'entry.fact', label: '已经发生的事实', value: payload.fact },
    { id: 'entry.emotion', label: '当下感受', value: payload.emotion },
  ];
  if (payload.interpretation) items.push({ id: 'entry.interpretation', label: '用户当时的解释', value: payload.interpretation });
  if (payload.worry) items.push({ id: 'entry.worry', label: '用户担心的事情', value: payload.worry });
  if (payload.next_question) items.push({ id: 'entry.next_question', label: '用户最想确认的问题', value: payload.next_question });
  let userIndex = 0;
  for (const message of payload.conversation ?? []) {
    if (message.role !== 'user') continue;
    userIndex += 1;
    items.push({ id: `dialogue.user_${userIndex}`, label: `第 ${userIndex} 次补充`, value: message.content });
  }
  return items;
}

function result(payload) {
  const items = evidence(payload);
  const userReplies = items.filter(item => item.id.startsWith('dialogue.user_'));
  const synthesis = payload.response_mode === 'synthesize' || userReplies.length > 0;
  const cited = synthesis && userReplies.length
    ? ['entry.fact', 'entry.worry', userReplies[userReplies.length - 1].id]
    : ['entry.fact', 'entry.emotion', 'entry.next_question'];
  return {
    status: 'ok',
    generated_at: new Date().toISOString(),
    model: 'deepseek-qa-mock',
    phase: synthesis ? 'synthesis' : 'clarify',
    headline: synthesis ? '先解除会改变全局的不确定性，再处理第二件事' : '现在最缺的不是努力，而是一条会改变排序的信息',
    what_i_heard: synthesis
      ? '你同时面对工作范围不清和家庭回应未完成。你补充的信息表明，工作截止时间会直接改变明天的安排，因此它是当前最关键的变量。'
      : '你同时背着工作范围不清和家庭回应未完成两件事，无力感来自两个方向都在等待你给出动作。',
    hypothesis: synthesis
      ? '目前更可能的情况是，先确认工作截止时间能降低大部分混乱，同时给家里一个有明确时间点的短回复，可以防止第二件事继续占用注意力。'
      : '一种可能的假设是，真正卡住你的不是工作和家里谁更重要，而是你还不知道哪一条信息会改变明天全部安排。',
    evidence_ids: cited,
    clarification_question: synthesis ? null : '如果明天只能消除一个不确定性，哪一个答案最会改变你接下来的安排？',
    options: synthesis ? [
      { title: '先确认工作边界', when_it_fits: '当客户截止时间会改变你明天全部排期时，这个顺序最合适。', tradeoff: '短时间内仍会保留家里的未回复感，需要随后补一个明确回应。' },
      { title: '先给家里一个两分钟回复', when_it_fits: '当工作答案今晚不可能得到，但你可以先降低关系压力时适合。', tradeoff: '它不会解决工作范围不清，回复后仍要马上回到截止时间确认。' },
    ] : [],
    next_step: synthesis ? '明早先发一条只问截止时间和交付范围的消息；等待回复时，用两分钟告诉家里你何时能确认周末安排。' : null,
    verification_question: synthesis ? '完成这两条消息后，你是否能清楚说出明天第一小时只做哪一件事？' : null,
    cautions: ['这只是依据你当前输入形成的工作假设，不代表他人的真实动机。'],
    disclosure: '本次内容由 DeepSeek 根据你主动提交的现实记录和本轮对话生成；知时不会把它当作命盘计算事实。',
    professional_advice_notice: '这是帮助你整理信息和比较选项的反思工具，不是医疗、心理、法律、财务或其他专业建议。',
    evidence_catalog: items,
    usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
  };
}

const server = http.createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, headers);
    response.end();
    return;
  }
  if (request.method === 'GET' && request.url === '/health') {
    json(response, 200, { status: 'ok', service: 'zhishi-api-qa', version: '0.1.0' });
    return;
  }
  if (request.method === 'POST' && request.url === '/api/v1/reflections/conversation/turn') {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      try {
        json(response, 200, result(JSON.parse(body)));
      } catch {
        json(response, 400, { detail: { code: 'invalid_json', message: 'invalid request' } });
      }
    });
    return;
  }
  json(response, 404, { detail: 'not found' });
});

server.listen(8000, '127.0.0.1');
