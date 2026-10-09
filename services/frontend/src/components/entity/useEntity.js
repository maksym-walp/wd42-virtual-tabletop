import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ENTITY_KINDS } from './entityRegistry';
import { fetchEntity } from './entityCache';

const IDLE = { status: 'idle', data: null };

// status: idle | loading | ok | missing (404) | denied (403) | error.
// Анонімним глядачам (публічні сторінки) запис не вантажимо взагалі: 401
// запустив би silent refresh, а той при невдачі веде на /login.
export default function useEntity(kind, id, enabled = true) {
  const { user } = useAuth() ?? {};
  const authed = !!user;
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    if (!enabled || !authed || !ENTITY_KINDS[kind] || !id) return undefined;
    let cancelled = false;
    setState((s) => (s.status === 'ok' ? s : { status: 'loading', data: null }));
    fetchEntity(kind, id)
      .then((data) => { if (!cancelled) setState({ status: 'ok', data }); })
      .catch((err) => {
        if (cancelled) return;
        const code = err?.response?.status;
        let status = 'error';
        if (code === 404) status = 'missing';
        else if (code === 403) status = 'denied';
        setState({ status, data: null });
      });
    return () => { cancelled = true; };
  }, [kind, id, enabled, authed]);

  return state;
}
