/**
 * Script de Teste de Estresse e Concorrência Transacional
 * API: Gestão de Pedidos ERP (NestJS + TypeORM + SQL Server)
 * 
 * Execução:
 *   node scripts/stress-test.mjs
 *   ou com URL customizada:
 *   API_URL=http://localhost:3001 node scripts/stress-test.mjs
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

// IDs dos Usuários Pré-configurados (Seed)
const USERS = {
  ADMIN: '44444444-4444-4444-4444-444444444444',
  SELLER: '66666666-6666-6666-6666-666666666666',
  INVENTORY: '33333333-3333-3333-3333-333333333333',
  VIP_CLIENT: '11111111-1111-1111-1111-111111111111',
  STANDARD_CLIENT: '22222222-2222-2222-2222-222222222222',
};

// Cores para saída no terminal
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function logHeader(title) {
  console.log(`\n${c.bold}${c.cyan}===============================================================`);
  console.log(`  ${title}`);
  console.log(`===============================================================${c.reset}\n`);
}

function logSuccess(msg) {
  console.log(`${c.green}✔ [PASS]${c.reset} ${msg}`);
}

function logError(msg) {
  console.log(`${c.red}✖ [FAIL]${c.reset} ${msg}`);
}

function logInfo(msg) {
  console.log(`${c.blue}ℹ [INFO]${c.reset} ${msg}`);
}

function logWarning(msg) {
  console.log(`${c.yellow}⚠ [WARN]${c.reset} ${msg}`);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': options.userId || USERS.ADMIN,
    ...(options.headers || {}),
  };

  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const duration = performance.now() - start;
    let data = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return {
      status: res.status,
      ok: res.ok,
      data,
      duration,
    };
  } catch (err) {
    const duration = performance.now() - start;
    return {
      status: 0,
      ok: false,
      error: err.message,
      duration,
    };
  }
}

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const getP = (p) => sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)];

  return {
    min: sorted[0].toFixed(2),
    max: sorted[sorted.length - 1].toFixed(2),
    mean: (sum / sorted.length).toFixed(2),
    p50: getP(50).toFixed(2),
    p90: getP(90).toFixed(2),
    p95: getP(95).toFixed(2),
    p99: getP(99).toFixed(2),
  };
}

// -------------------------------------------------------------
// CENÁRIO 1: CONCORRÊNCIA EXTREMA & PREVENÇÃO DE OVERBOOKING
// -------------------------------------------------------------
async function runConcurrencyOverbookingTest() {
  logHeader('TESTE 1: Concorrência Extrema e Prevenção de Overbooking');
  console.log('Simulando 30 clientes simultâneos tentando comprar de um produto com estoque limitado de 10 unidades...\n');

  // 1. Criar um produto de teste exclusivo com estoque 10
  logInfo('Criando produto de teste de alta concorrência...');
  const prodRes = await request('/products', {
    method: 'POST',
    userId: USERS.ADMIN,
    body: {
      name: `Produto Stress Test - ${Date.now().toString().slice(-4)}`,
      price: 199.90,
    },
  });

  if (!prodRes.ok || !prodRes.data?.id) {
    logError(`Falha ao criar produto de teste: HTTP ${prodRes.status}`);
    return false;
  }
  const productId = prodRes.data.id;
  logInfo(`Produto criado com sucesso: ${productId}`);

  // 2. Repor estoque para exatamente 10 unidades
  logInfo('Definindo estoque inicial para exatamente 10 unidades...');
  const replenishRes = await request('/inventory/replenish', {
    method: 'POST',
    userId: USERS.INVENTORY,
    body: { productId, quantity: 10 },
  });

  if (!replenishRes.ok) {
    logError(`Falha ao repor estoque inicial: HTTP ${replenishRes.status}`);
    return false;
  }

  // 3. Gerar 30 pedidos em paralelo (1 unidade cada)
  logInfo('Disparando 30 pedidos simultâneos em paralelo...');
  const TOTAL_ORDERS = 30;
  const orderCreationPromises = Array.from({ length: TOTAL_ORDERS }, (_, i) => {
    const isVip = i % 2 === 0;
    const userId = isVip ? USERS.VIP_CLIENT : USERS.STANDARD_CLIENT;
    return request('/orders', {
      method: 'POST',
      userId,
      body: {
        fulfillmentStrategy: 'ALL',
        items: [{ productId, quantity: 1 }],
      },
    });
  });

  const orderCreationResults = await Promise.all(orderCreationPromises);
  const createdOrderIds = orderCreationResults
    .filter((r) => r.ok && r.data?.id)
    .map((r) => r.data.id);

  logInfo(`${createdOrderIds.length} pedidos criados com sucesso. Aprovando todos...`);

  // Aprovar todos os pedidos para ficarem aptos à reserva
  await Promise.all(
    createdOrderIds.map((id) =>
      request(`/orders/${id}/approve`, { method: 'POST', userId: USERS.SELLER }),
    ),
  );

  // 4. DISPARO CONCORRENTE MASSIVO: 30 tentativas simultâneas de reserva
  console.log(`\n${c.bold}⚡ Disparando 30 reservas SIMULTÂNEAS no banco (Lock Pessimista + Transação)...${c.reset}`);
  const reservationPromises = createdOrderIds.map((id) =>
    request(`/orders/${id}/reserve`, { method: 'POST', userId: USERS.INVENTORY }),
  );

  const reservationResults = await Promise.all(reservationPromises);

  // 5. Analisar resultados
  let successCount = 0;
  let conflictCount = 0;
  let errorCount = 0;
  const latencies = [];

  for (const res of reservationResults) {
    latencies.push(res.duration);
    if (res.status === 200 || res.status === 201) {
      successCount++;
    } else if (res.status === 409) {
      conflictCount++;
    } else {
      errorCount++;
    }
  }

  // 6. Validar estado final do estoque
  const stockCheck = await request(`/products/${productId}/stock`, { userId: USERS.ADMIN });
  const finalStock = stockCheck.data?.availableQuantity;

  console.log('\n' + '-'.repeat(50));
  console.log(`${c.bold}RESULTADOS DO TESTE DE CONCORRÊNCIA:${c.reset}`);
  console.log(`- Reservas com Sucesso (Esperado: 10):  ${successCount === 10 ? c.green : c.red}${successCount}${c.reset}`);
  console.log(`- Rejeições por Estoque Esgotado (409): ${conflictCount === 20 ? c.green : c.red}${conflictCount}${c.reset}`);
  console.log(`- Erros Inesperados (HTTP 500/Outros):  ${errorCount === 0 ? c.green : c.red}${errorCount}${c.reset}`);
  console.log(`- Saldo Final do Estoque (Esperado: 0): ${finalStock === 0 ? c.green : c.red}${finalStock}${c.reset}`);
  console.log('-'.repeat(50));

  const stats = calculatePercentiles(latencies);
  console.log(`Latência das reservas: Mín=${stats.min}ms | Méd=${stats.mean}ms | p95=${stats.p95}ms | Máx=${stats.max}ms`);

  let testPassed = true;
  if (successCount === 10 && conflictCount === 20 && finalStock === 0 && errorCount === 0) {
    logSuccess('Nenhum overbooking ocorreu! Lock pessimista e transações funcionaram com 100% de consistência.');
  } else {
    logError('Inconsistência detectada durante concorrência de estoque!');
    testPassed = false;
  }

  return testPassed;
}

// -------------------------------------------------------------
// CENÁRIO 2: TESTE DE CARGA, LATÊNCIA & THROUGHPUT (RPS)
// -------------------------------------------------------------
async function runLoadAndThroughputTest(totalRequests = 150, concurrency = 15) {
  logHeader(`TESTE 2: Carga, Throughput (RPS) e Perfil de Latência (${totalRequests} reqs, concurrência ${concurrency})`);

  logInfo(`Enviando ${totalRequests} requisições mistas (leituras e escritas) em lotes de ${concurrency}...`);

  const latencies = [];
  let successCount = 0;
  let failCount = 0;
  const endpointStats = {
    'GET /orders (Listagem Paginada)': { count: 0, ok: 0, latencies: [] },
    'GET /products (Catálogo com Estoque)': { count: 0, ok: 0, latencies: [] },
    'GET /orders/stats (Métricas & KPIs)': { count: 0, ok: 0, latencies: [] },
    'GET /customers (Clientes & Perfis)': { count: 0, ok: 0, latencies: [] },
  };

  const startTime = performance.now();

  for (let i = 0; i < totalRequests; i += concurrency) {
    const batchSize = Math.min(concurrency, totalRequests - i);
    const batch = Array.from({ length: batchSize }, (_, idx) => {
      const opIndex = (i + idx) % 4;
      if (opIndex === 0) {
        return request('/orders?page=1&limit=10', { userId: USERS.SELLER }).then(r => ({ ...r, label: 'GET /orders (Listagem Paginada)' }));
      } else if (opIndex === 1) {
        return request('/products?page=1&limit=50', { userId: USERS.STANDARD_CLIENT }).then(r => ({ ...r, label: 'GET /products (Catálogo com Estoque)' }));
      } else if (opIndex === 2) {
        return request('/orders/stats', { userId: USERS.SELLER }).then(r => ({ ...r, label: 'GET /orders/stats (Métricas & KPIs)' }));
      } else {
        return request('/customers', { userId: USERS.ADMIN }).then(r => ({ ...r, label: 'GET /customers (Clientes & Perfis)' }));
      }
    });

    const results = await Promise.all(batch);
    for (const r of results) {
      latencies.push(r.duration);
      if (endpointStats[r.label]) {
        endpointStats[r.label].count++;
        endpointStats[r.label].latencies.push(r.duration);
        if (r.ok) endpointStats[r.label].ok++;
      }
      if (r.ok) successCount++;
      else failCount++;
    }
  }

  const totalDurationSeconds = (performance.now() - startTime) / 1000;
  const rps = (totalRequests / totalDurationSeconds).toFixed(2);
  const stats = calculatePercentiles(latencies);

  console.log('\n' + '='.repeat(50));
  console.log(`${c.bold}DETALHAMENTO POR ENDPOINT (${totalRequests} REQUISIÇÕES):${c.reset}`);
  console.log('-'.repeat(50));
  for (const [endpoint, data] of Object.entries(endpointStats)) {
    const epStats = calculatePercentiles(data.latencies);
    console.log(`• ${c.bold}${endpoint}${c.reset}`);
    console.log(`  Disparos: ${data.count} | Sucessos: ${data.ok === data.count ? c.green : c.red}${data.ok}/${data.count}${c.reset} | Média: ${epStats.mean}ms | p95: ${epStats.p95}ms`);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`${c.bold}MÉTRICAS GERAIS DE DESEMPENHO E LATÊNCIA:${c.reset}`);
  console.log(`- Total de Requisições:   ${totalRequests}`);
  console.log(`- Requisições com Sucesso: ${c.green}${successCount}${c.reset}`);
  console.log(`- Requisições com Falha:   ${failCount > 0 ? c.red : c.green}${failCount}${c.reset}`);
  console.log(`- Duração Total:          ${totalDurationSeconds.toFixed(2)}s`);
  console.log(`- Throughput (RPS):       ${c.bold}${c.cyan}${rps} req/s${c.reset}`);
  console.log(`- Latência Mínima:        ${stats.min} ms`);
  console.log(`- Latência Média:         ${stats.mean} ms`);
  console.log(`- Latência p50 (Mediana): ${stats.p50} ms`);
  console.log(`- Latência p90:           ${stats.p90} ms`);
  console.log(`- Latência p95:           ${stats.p95} ms`);
  console.log(`- Latência p99:           ${stats.p99} ms`);
  console.log(`- Latência Máxima:        ${stats.max} ms`);
  console.log('='.repeat(50));

  if (failCount === 0) {
    logSuccess(`Teste de carga concluído com 100% de sucesso (${rps} req/s).`);
    return true;
  } else {
    logWarning(`Teste concluído com ${failCount} falhas.`);
    return false;
  }
}

// -------------------------------------------------------------
// CENÁRIO 3: MÉTRICAS DA FILA & PRIORIZAÇÃO VIP
// -------------------------------------------------------------
async function runQueueMetricsTest() {
  logHeader('TESTE 3: Verificação de Telemetria e Fila de Execução');

  logInfo('Consultando métricas da fila de prioridade...');
  const queueRes = await request('/orders/queue/metrics', { userId: USERS.ADMIN });

  if (queueRes.ok) {
    console.log('\n' + '-'.repeat(50));
    console.log(`${c.bold}TELEMETRIA DA FILA DE PRIORIDADE (OrderQueueService):${c.reset}`);
    console.log(`- Total de Tarefas Processadas:  ${c.cyan}${queueRes.data.totalProcessed}${c.reset}`);
    console.log(`- Tarefas Pendentes na Fila:     ${queueRes.data.pendingTasks}`);
    console.log(`- Fila em Processamento Ativo:   ${queueRes.data.isProcessing ? 'Sim' : 'Não'}`);
    console.log(`- Partições Ativas:              ${queueRes.data.activePartitions}`);
    console.log(`- Tempo Médio de Espera na Fila: ${queueRes.data.averageWaitTimeMs} ms`);
    console.log(`- Tempo Médio de Execução:       ${queueRes.data.averageExecutionTimeMs} ms`);
    console.log('-'.repeat(50));
    logSuccess('Métricas da fila consultadas com sucesso.');
    return true;
  } else {
    logError(`Falha ao obter métricas da fila: HTTP ${queueRes.status}`);
    return false;
  }
}

// -------------------------------------------------------------
// FLUXO PRINCIPAL
// -------------------------------------------------------------
async function main() {
  console.log(`\n${c.bold}${c.magenta}╔═══════════════════════════════════════════════════════════════════╗`);
  console.log(`║     SUÍTE DE TESTE DE ESTRESSE & CONCORRÊNCIA DO BACKEND          ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════╝${c.reset}`);
  console.log(`Target API: ${c.cyan}${BASE_URL}${c.reset}`);

  // Teste de Conexão Inicial
  logInfo('Verificando disponibilidade do backend...');
  const healthCheck = await request('/products', { userId: USERS.ADMIN });
  if (healthCheck.status === 0) {
    logError(`Não foi possível conectar ao backend em ${BASE_URL}.`);
    console.log(`\n${c.yellow}Por favor, certifique-se de que o backend está rodando:${c.reset}`);
    console.log(`  1. docker compose up -d (para o banco SQL Server)`);
    console.log(`  2. cd backend && npm run start:dev\n`);
    process.exit(1);
  }

  logSuccess(`Backend ativo e respondendo na porta ${new URL(BASE_URL).port || 80}!\n`);

  const results = [];
  results.push(await runConcurrencyOverbookingTest());
  results.push(await runLoadAndThroughputTest(100, 10));
  results.push(await runQueueMetricsTest());

  logHeader('RESUMO FINAL DOS TESTES');
  const allPassed = results.every(Boolean);
  if (allPassed) {
    console.log(`${c.bold}${c.green}🎉 TODOS OS TESTES DE ESTRESSE E CONCORRÊNCIA PASSARAM COM SUCESSO! 🎉${c.reset}\n`);
  } else {
    console.log(`${c.bold}${c.yellow}⚠ Alguns testes apresentaram inconsistências. Revise o log acima.${c.reset}\n`);
  }
}

main().catch((err) => {
  console.error('Erro fatal durante a execução do teste:', err);
  process.exit(1);
});
