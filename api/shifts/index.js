import { listShifts, replaceAllShifts, validateShiftArray } from '../_lib/shifts-store.js';

function sendJson(res, statusCode, payload) {
  res.status(statusCode).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const shifts = await listShifts();
      return sendJson(res, 200, { shifts });
    }

    if (req.method === 'PUT') {
      const payload = req.body ?? {};
      if (!validateShiftArray(payload.shifts)) {
        return sendJson(res, 400, { error: 'Invalid shifts payload' });
      }

      const shifts = await replaceAllShifts(payload.shifts);
      return sendJson(res, 200, { saved: shifts.length });
    }

    res.setHeader('Allow', 'GET, PUT');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('[api/shifts] error', error);
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Unexpected API error',
    });
  }
}
