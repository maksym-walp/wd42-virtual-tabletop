import { ENTITY_KINDS } from './entityRegistry';
import { cached } from './memoCache';

export const fetchEntity = (kind, id) => cached(`${kind}:${id}`, () => ENTITY_KINDS[kind].fetch(id));
