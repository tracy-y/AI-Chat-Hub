export const ProviderRunStatus = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

const allowedTransitions = Object.freeze({
  [ProviderRunStatus.QUEUED]: new Set([
    ProviderRunStatus.RUNNING,
    ProviderRunStatus.CANCELLED,
  ]),
  [ProviderRunStatus.RUNNING]: new Set([
    ProviderRunStatus.COMPLETED,
    ProviderRunStatus.FAILED,
    ProviderRunStatus.CANCELLED,
  ]),
  [ProviderRunStatus.COMPLETED]: new Set(),
  [ProviderRunStatus.FAILED]: new Set(),
  [ProviderRunStatus.CANCELLED]: new Set(),
});

export function createProviderRun({ id, providerId, prompt, createdAt }) {
  if (!id || !providerId || !prompt?.trim()) {
    throw new TypeError("id, providerId, and a non-empty prompt are required");
  }

  return Object.freeze({
    id,
    providerId,
    prompt,
    status: ProviderRunStatus.QUEUED,
    createdAt: createdAt ?? new Date().toISOString(),
    response: null,
    error: null,
  });
}

export function transitionProviderRun(run, nextStatus, patch = {}) {
  if (!allowedTransitions[run.status]?.has(nextStatus)) {
    throw new Error(`Invalid provider run transition: ${run.status} -> ${nextStatus}`);
  }

  if (nextStatus === ProviderRunStatus.COMPLETED && !patch.response) {
    throw new Error("A completed provider run requires a response");
  }

  if (nextStatus === ProviderRunStatus.FAILED && !patch.error) {
    throw new Error("A failed provider run requires an error");
  }

  return Object.freeze({ ...run, ...patch, status: nextStatus });
}
