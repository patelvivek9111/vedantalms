const { resolveQueueProvider } = require('../../config/providers');
const { BullMQAdapter } = require('../../adapters/jobs/bullMQAdapter');

let queueInstance = null;

function getJobQueueService() {
  if (!queueInstance) {
    const provider = resolveQueueProvider();
    const adapter = provider === 'inline' ? new BullMQAdapter() : new BullMQAdapter();
    queueInstance = {
      provider,
      adapter,
      enqueue: (...args) => adapter.enqueue(...args),
      getJob: (...args) => adapter.getJob(...args),
      startWorker: () => adapter.startWorker(),
      shouldRunInline: () => adapter.shouldRunInline(),
      shouldUseAsync: (n) => adapter.shouldUseAsync(n),
      getCapabilities: () => adapter.getCapabilities(),
    };
  }
  return queueInstance;
}

module.exports = {
  getJobQueueService,
};
