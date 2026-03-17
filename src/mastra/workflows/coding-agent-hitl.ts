import { createStep, createWorkflow } from '@mastra/core/workflows';
import { ApprovalPendingError } from '@openbox-ai/openbox-mastra-sdk';
import z from 'zod';
import { codingAgent } from '../agents/coding-agent';

const codingAgentHitlInputSchema = z.object({
  resourceId: z.string().optional(),
  task: z.string().min(1),
  threadId: z.string().optional(),
});

const codingAgentHitlOutputSchema = z.object({
  agentRunId: z.string(),
  finishReason: z.string(),
  text: z.string(),
});

const codingAgentResumeSchema = z
  .object({
    agentResumeData: z.unknown().optional(),
  })
  .optional();

const codingAgentSuspendSchema = z.object({
  agentRunId: z.string(),
  reason: z.string(),
  suspendPayload: z.unknown().optional(),
});

type CodingAgentHitlInput = z.infer<typeof codingAgentHitlInputSchema>;
type CodingAgentResumeData = z.infer<typeof codingAgentResumeSchema>;

interface CodingAgentHitlState {
  agentRunId?: string;
  awaitingResume?: boolean;
}

interface AgentSnapshot {
  finishReason?: string;
  runId?: string;
  suspendPayload?: unknown;
  text: string;
}

function readWorkflowState(state: unknown): CodingAgentHitlState {
  if (!state || typeof state !== 'object') {
    return {};
  }

  const stateRecord = state as Record<string, unknown>;

  return {
    agentRunId:
      typeof stateRecord.agentRunId === 'string' ? stateRecord.agentRunId : undefined,
    awaitingResume: stateRecord.awaitingResume === true,
  };
}

function readResumeData(resumeData: unknown): CodingAgentResumeData {
  if (!resumeData || typeof resumeData !== 'object') {
    return undefined;
  }

  return resumeData as CodingAgentResumeData;
}

function buildAgentExecutionOptions(runId: string, inputData: CodingAgentHitlInput) {
  const options: Record<string, unknown> = {
    runId,
  };

  if (inputData.threadId) {
    options.threadId = inputData.threadId;
  }

  if (inputData.resourceId) {
    options.resourceId = inputData.resourceId;
  }

  return options;
}

function extractAgentSnapshot(result: unknown): AgentSnapshot {
  if (!result || typeof result !== 'object') {
    return { text: '' };
  }

  const record = result as Record<string, unknown>;

  return {
    finishReason: typeof record.finishReason === 'string' ? record.finishReason : undefined,
    runId: typeof record.runId === 'string' ? record.runId : undefined,
    suspendPayload: record.suspendPayload,
    text: typeof record.text === 'string' ? record.text : '',
  };
}

async function resumeCodingAgent(
  agentRunId: string,
  inputData: CodingAgentHitlInput,
  resumeData: CodingAgentResumeData,
) {
  const resumableAgent = codingAgent as unknown as {
    resumeGenerate?: (
      resumePayload: unknown,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
  };

  if (!resumableAgent.resumeGenerate) {
    throw new Error('codingAgent.resumeGenerate is unavailable');
  }

  return resumableAgent.resumeGenerate(
    resumeData?.agentResumeData,
    buildAgentExecutionOptions(agentRunId, inputData),
  );
}

const runCodingAgentStep = createStep({
  id: 'run-coding-agent-step',
  inputSchema: codingAgentHitlInputSchema,
  outputSchema: codingAgentHitlOutputSchema,
  resumeSchema: codingAgentResumeSchema,
  suspendSchema: codingAgentSuspendSchema,
  execute: async ({ inputData, resumeData, runId, setState, state, suspend }) => {
    const workflowState = readWorkflowState(state);
    const parsedResumeData = readResumeData(resumeData);
    const agentRunId = workflowState.agentRunId ?? `${runId}:agent`;
    const shouldResume = workflowState.awaitingResume === true || parsedResumeData !== undefined;

    try {
      const rawResult = shouldResume
        ? await resumeCodingAgent(agentRunId, inputData, parsedResumeData)
        : await codingAgent.generate(inputData.task, buildAgentExecutionOptions(agentRunId, inputData) as never);
      const agentSnapshot = extractAgentSnapshot(rawResult);
      const nextAgentRunId = agentSnapshot.runId ?? agentRunId;

      if (agentSnapshot.finishReason === 'suspended') {
        await setState({
          ...workflowState,
          agentRunId: nextAgentRunId,
          awaitingResume: true,
        });

        return suspend({
          agentRunId: nextAgentRunId,
          reason: 'OpenBox approval is required before the coding agent can continue.',
          suspendPayload: agentSnapshot.suspendPayload,
        });
      }

      await setState({
        ...workflowState,
        agentRunId: nextAgentRunId,
        awaitingResume: false,
      });

      return {
        agentRunId: nextAgentRunId,
        finishReason: agentSnapshot.finishReason ?? 'stop',
        text: agentSnapshot.text,
      };
    } catch (error) {
      if (error instanceof ApprovalPendingError) {
        await setState({
          ...workflowState,
          agentRunId,
          awaitingResume: true,
        });

        return suspend({
          agentRunId,
          reason: error.message,
        });
      }

      throw error;
    }
  },
});

export const codingAgentHitlWorkflow = createWorkflow({
  id: 'coding-agent-hitl-workflow',
  inputSchema: codingAgentHitlInputSchema,
  outputSchema: codingAgentHitlOutputSchema,
})
  .then(runCodingAgentStep)
  .commit();
