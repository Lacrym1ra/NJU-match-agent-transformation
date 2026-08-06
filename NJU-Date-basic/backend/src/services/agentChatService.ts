import OpenAI from 'openai';
import { config } from '../config.js';
import { agentReadService } from './agentReadService.js';
import { AppError } from '../utils/errors.js';

const SYSTEM_PROMPT = `You are the user-facing NJU Match social assistant.
Answer in concise, friendly Chinese. Use only the supplied account and search
context; never invent circles, posts, profile fields, or completed actions.
You may recommend results and explain next steps. Publishing a post or joining
a circle always requires an explicit confirmation in the UI, so never claim a
write action has already happened.`;

export interface AgentChatReply {
  reply: string;
  provider: 'openai-compatible';
  model: string;
  circles: Awaited<ReturnType<typeof agentReadService.searchCircles>>['circles'];
  posts: Awaited<ReturnType<typeof agentReadService.searchForumPosts>>['posts'];
}

export async function createAgentChatReply(userId: string, message: string): Promise<AgentChatReply> {
  if (!config.agentLlm.apiKey) {
    throw Object.assign(new Error('Agent LLM is not configured'), { status: 503, code: 'AGENT_LLM_NOT_CONFIGURED' });
  }

  const [profile, questionnaire, circleResult, postResult] = await Promise.all([
    agentReadService.getMyProfileStatus(userId),
    agentReadService.getQuestionnaireStatus(userId),
    agentReadService.searchCircles(userId, { query: message, sort: 'recommended', limit: 6 }),
    agentReadService.searchForumPosts(userId, { query: message, sort: 'latest', limit: 6 }),
  ]);

  const client = new OpenAI({ apiKey: config.agentLlm.apiKey, baseURL: config.agentLlm.baseUrl });
  let response;
  try {
    response = await client.responses.create({
      model: config.agentLlm.model,
      instructions: SYSTEM_PROMPT,
      input: `User request:\n${message}\n\nAvailable context:\n${JSON.stringify({
        profile, questionnaire, circles: circleResult.circles, posts: postResult.posts,
      })}`,
    });
  } catch {
    // Do not forward SDK errors: authentication failures may include a masked
    // credential fragment and provider-specific request metadata.
    throw new AppError(502, 'AGENT_LLM_UNAVAILABLE', '模型服务暂时不可用，请检查 API Key、Base URL 和模型配置');
  }

  return {
    reply: response.output_text.trim() || '我已完成检索，但暂时无法生成总结。',
    provider: 'openai-compatible',
    model: config.agentLlm.model,
    circles: circleResult.circles,
    posts: postResult.posts,
  };
}
