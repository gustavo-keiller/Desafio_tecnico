import { OrderQueueService, QueuePriority } from './order-queue.service';

describe('OrderQueueService (Unit Tests)', () => {
  let service: OrderQueueService;

  beforeEach(() => {
    service = new OrderQueueService();
  });

  it('deve processar uma tarefa simples com sucesso', async () => {
    const result = await service.enqueue(
      QueuePriority.STANDARD,
      async () => 'sucesso',
      'Teste Simples',
    );
    expect(result).toBe('sucesso');
  });

  it('deve respeitar a ordem de prioridade na fila (VIP > STANDARD)', async () => {
    const executionOrder: string[] = [];

    // Enqueue a slow task to hold the queue processing
    const slowTask = service.enqueue(
      QueuePriority.STANDARD,
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        executionOrder.push('slow');
      },
      'Slow Task',
    );

    // Enqueue standard task and VIP task while slow task is executing
    const standardTask = service.enqueue(
      QueuePriority.STANDARD,
      async () => {
        executionOrder.push('standard');
      },
      'Standard Task',
    );

    const vipTask = service.enqueue(
      QueuePriority.VIP_CLIENT,
      async () => {
        executionOrder.push('vip');
      },
      'VIP Task',
    );

    await Promise.all([slowTask, standardTask, vipTask]);

    expect(executionOrder).toEqual(['slow', 'vip', 'standard']);
  });

  it('deve propagar erros da tarefa sem travar o processamento da fila', async () => {
    const failingTask = service.enqueue(
      QueuePriority.STANDARD,
      async () => {
        throw new Error('Falha simulada');
      },
      'Failing Task',
    );

    await expect(failingTask).rejects.toThrow('Falha simulada');

    // Subsequent task should execute normally
    const nextTask = await service.enqueue(
      QueuePriority.STANDARD,
      async () => 'recuperado',
      'Next Task',
    );
    expect(nextTask).toBe('recuperado');
  });

  it('deve calcular métricas de telemetria corretamente', async () => {
    await service.enqueue(
      QueuePriority.STANDARD,
      async () => 42,
      'Metrics Task',
    );
    const metrics = service.getMetrics();
    expect(metrics.totalProcessed).toBe(1);
    expect(metrics.pendingTasks).toBe(0);
    expect(metrics.isProcessing).toBe(false);
  });
});
