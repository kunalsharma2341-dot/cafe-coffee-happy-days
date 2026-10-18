import { getStore } from '@netlify/blobs';
import { createHandler } from '../../server/api.mjs';
export default async (request, context) =>
  createHandler({
    getStore,
    env: { ...process.env, CONTEXT: context.deploy?.context || process.env.CONTEXT || 'dev' },
  })(request, context);
export const config = { path: '/api/*' };
