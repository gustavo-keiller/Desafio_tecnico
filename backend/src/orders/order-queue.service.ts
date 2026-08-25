import { Injectable, Logger } from '@nestjs/common';

export enum QueuePriority {
  REPLENISH = 100, // Highest: Stock replenishment unlocks pending orders immediately
  CANCEL = 50, // High: Free up stock quickly for other buyers
  VIP_CLIENT = 10, // Medium-High: VIP / Favorite clients jump the queue
  STANDARD = 1, // Normal: Standard orders & operations
}

interface QueueTask {
  id: string;
  description: string;
  partitionKey: string;
  priority: number;
  timestamp: number;
  enqueuedAt: number;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export interface QueueMetrics {
  totalProcessed: number;
  pendingTasks: number;
  isProcessing: boolean;
  activePartitions: number;
  averageWaitTimeMs: number;
  averageExecutionTimeMs: number;
}

@Injectable()
export class OrderQueueService {
  private readonly logger = new Logger(OrderQueueService.name);

  // Partitioned queues: tasks with different partition keys execute in parallel
  private queues: Map<string, QueueTask[]> = new Map();
  private processingPartitions: Set<string> = new Set();
  private counter = 0;

  // Telemetry metrics
  private totalProcessed = 0;
  private totalWaitTimeMs = 0;
  private totalExecutionTimeMs = 0;

  /**
   * Enqueues a task to be processed sequentially based on priority and FIFO within its partition.
   * Tasks on disjoint partitions process concurrently in parallel.
   */
  async enqueue<T>(
    priority: number = QueuePriority.STANDARD,
    execute: () => Promise<T>,
    description: string = 'Operation',
    partitionKey: string = '__default__',
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskId = `task_${++this.counter}`;
      const enqueuedAt = Date.now();

      const task: QueueTask = {
        id: taskId,
        description,
        partitionKey,
        priority,
        timestamp: this.counter,
        enqueuedAt,
        execute,
        resolve,
        reject,
      };

      if (!this.queues.has(partitionKey)) {
        this.queues.set(partitionKey, []);
      }
      const partitionQueue = this.queues.get(partitionKey)!;
      partitionQueue.push(task);

      // Stable priority sorting (highest priority first, then FIFO)
      partitionQueue.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      this.processPartition(partitionKey);
    });
  }

  private async processPartition(partitionKey: string) {
    if (this.processingPartitions.has(partitionKey)) return;
    this.processingPartitions.add(partitionKey);

    const partitionQueue = this.queues.get(partitionKey);
    if (!partitionQueue) {
      this.processingPartitions.delete(partitionKey);
      return;
    }

    while (partitionQueue.length > 0) {
      const task = partitionQueue.shift();
      if (task) {
        const startTime = Date.now();
        const waitTime = startTime - task.enqueuedAt;

        try {
          const result = await task.execute();
          const executionDuration = Date.now() - startTime;

          // Track telemetry
          this.totalProcessed++;
          this.totalWaitTimeMs += waitTime;
          this.totalExecutionTimeMs += executionDuration;

          this.logger.debug(
            `[Queue Partition: ${partitionKey}] Executed "${task.description}" (Priority: ${task.priority}) | Wait: ${waitTime}ms | Exec: ${executionDuration}ms`,
          );

          task.resolve(result);
        } catch (error) {
          task.reject(error);
        }
      }
    }

    // Clean up empty partition
    if (partitionQueue.length === 0) {
      this.queues.delete(partitionKey);
    }
    this.processingPartitions.delete(partitionKey);
  }

  getMetrics(): QueueMetrics {
    let pendingCount = 0;
    for (const q of this.queues.values()) {
      pendingCount += q.length;
    }

    return {
      totalProcessed: this.totalProcessed,
      pendingTasks: pendingCount,
      isProcessing: this.processingPartitions.size > 0,
      activePartitions: this.processingPartitions.size,
      averageWaitTimeMs:
        this.totalProcessed > 0
          ? Math.round(this.totalWaitTimeMs / this.totalProcessed)
          : 0,
      averageExecutionTimeMs:
        this.totalProcessed > 0
          ? Math.round(this.totalExecutionTimeMs / this.totalProcessed)
          : 0,
    };
  }
}
