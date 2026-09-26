import extractInquiry from '../lib/ai/extract-inquiry.js';
import analyzeVisualization from '../lib/ai/analyze-visualization.js';
import buildPlan from '../lib/ai/build-plan.js';
import { json } from '../lib/http.js';

const handlers = {
  'extract-inquiry': extractInquiry,
  'analyze-visualization': analyzeVisualization,
  'build-plan': buildPlan
};

export default async function handler(req, res) {
  const action = String(req.query?.action || '');
  const actionHandler = handlers[action];
  if (!actionHandler) return json(res, 404, { error: 'Nieznana operacja AI.' });
  return actionHandler(req, res);
}
