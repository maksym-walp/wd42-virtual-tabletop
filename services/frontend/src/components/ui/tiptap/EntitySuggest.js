import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// «@» + кілька літер у редакторі → відкриває вибір запису сайту. Це власна
// мінімальна версія @tiptap/suggestion (пакет не тягнемо заради одного тригера):
// плагін лише стежить за текстом перед курсором і повідомляє React про
// { from, to, query, rect } через handlers.onState; клавіші (стрілки/Enter/Tab)
// делегує handlers.onKeyDown, Escape закриває підказку до наступного «@».

const key = new PluginKey('entitySuggest');
// «@» на початку блоку, після пробілу або після вузла (чіпа/кубика).
const TRIGGER = /(?:^|[\s￼])@([^@\n]{0,40})$/;

function findMatch(state) {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const m = TRIGGER.exec(before);
  if (!m) return null;
  return { from: $from.pos - m[1].length - 1, to: $from.pos, query: m[1] };
}

const EntitySuggest = Extension.create({
  name: 'entitySuggest',

  addOptions() {
    return { handlers: null };
  },

  addProseMirrorPlugins() {
    const { handlers } = this.options;
    return [
      new Plugin({
        key,
        state: {
          init: () => ({ match: null, dismissed: null }),
          apply(tr, prev, _oldState, newState) {
            let dismissed = tr.getMeta(key)?.dismiss ?? prev.dismissed;
            let match = findMatch(newState);
            if (!match) dismissed = null;
            else if (match.from === dismissed) match = null;
            return { match, dismissed };
          },
        },
        view() {
          let last = null;
          return {
            update(view) {
              const { match } = key.getState(view.state);
              const sig = match && `${match.from}:${match.query}`;
              if (sig === last) return;
              last = sig;
              handlers?.onState(match ? { ...match, rect: view.coordsAtPos(match.to) } : null);
            },
            destroy() {
              handlers?.onState(null);
            },
          };
        },
        props: {
          handleKeyDown(view, event) {
            const { match } = key.getState(view.state);
            if (!match) return false;
            if (event.key === 'Escape') {
              view.dispatch(view.state.tr.setMeta(key, { dismiss: match.from }));
              return true;
            }
            return handlers?.onKeyDown(event) ?? false;
          },
        },
      }),
    ];
  },
});

export default EntitySuggest;
