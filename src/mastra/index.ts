import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { withOpenBox } from '@openbox-ai/openbox-mastra-sdk';
import { codingAgent } from './agents/coding-agent';

function buildMastra() {
  return new Mastra({
    agents: { codingAgent },
    storage: new LibSQLStore({
      id: 'coding-agent-storage',
      url: 'file:../../mastra.db',
    }),
    logger: new PinoLogger({
      name: 'Mastra',
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
  });
}

type CodingAgentMastra = ReturnType<typeof buildMastra>;

declare global {
  var __openboxCodingAgentMastra: Promise<CodingAgentMastra> | undefined;
}

const governedMastra =
  globalThis.__openboxCodingAgentMastra ?? withOpenBox(buildMastra());

if (!globalThis.__openboxCodingAgentMastra) {
  globalThis.__openboxCodingAgentMastra = governedMastra;
}

export const mastra = await governedMastra;
