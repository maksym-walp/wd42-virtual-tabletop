import { Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useCallback } from 'react';
import EntityLinkChip from '../../entity/EntityLinkChip';
import { ENTITY_KINDS, entityHref, parseEntityHref } from '../../entity/entityRegistry';

function EntityLinkView({ node, editor, selected, updateAttributes }) {
  const { kind, id, form, label, live } = node.attrs;

  // Назва живого посилання лишається в HTML запасним текстом (для прев'ю в
  // картках і для тих, хто не може завантажити запис) — тримаємо її свіжою.
  // setTimeout: транзакція не повинна летіти з ефекту під час рендеру node view.
  const syncLabel = useCallback((name) => {
    if (!editor.isEditable || name === label) return;
    setTimeout(() => updateAttributes({ label: name }), 0);
  }, [editor, label, updateAttributes]);

  return (
    <NodeViewWrapper as="span" contentEditable={false} className="inline">
      <EntityLinkChip
        kind={kind}
        id={id}
        form={form}
        label={label}
        live={live}
        editable={editor.isEditable}
        selected={selected}
        onResolvedName={syncLabel}
      />
    </NodeViewWrapper>
  );
}

// Атомарний inline-вузол: посилання на запис іншого сервісу сайту. Зберігається
// як `<a href="/spellbook/<id>" data-type="entity-link" data-kind data-id …>назва</a>` —
// звичайний посилання, що працює і без редактора. Старі `<a href="/spellbook/<id>">`
// при завантаженні самі стають такими вузлами (без SQL-міграції); live=false
// означає «текст задав автор» — його не підміняємо актуальною назвою.
const EntityLinkNode = Node.create({
  name: 'entityLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      kind: { default: null, rendered: false },
      id: { default: null, rendered: false },
      form: { default: null, rendered: false },
      label: { default: '', rendered: false },
      live: { default: true, rendered: false },
    };
  },

  // Пріоритет вищий за Link-марку (a[href]), інакше внутрішнє посилання
  // лишилось би звичайним текстом із маркою.
  parseHTML() {
    return [
      {
        tag: 'a[data-type="entity-link"]',
        priority: 1002,
        getAttrs: (el) => {
          const kind = el.getAttribute('data-kind');
          const id = el.getAttribute('data-id');
          if (!ENTITY_KINDS[kind] || !id) return false;
          return {
            kind,
            id,
            form: el.getAttribute('data-form') || null,
            label: el.textContent || '',
            live: el.getAttribute('data-live') === '1',
          };
        },
      },
      {
        tag: 'a[href]',
        priority: 1001,
        getAttrs: (el) => {
          const parsed = parseEntityHref(el.getAttribute('href'));
          if (!parsed) return false;
          return { ...parsed, label: el.textContent || '', live: false };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const { kind, id, form, label, live } = node.attrs;
    return [
      'a',
      {
        href: entityHref(kind, id, form),
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-type': 'entity-link',
        'data-kind': kind,
        'data-id': id,
        ...(form ? { 'data-form': form } : {}),
        ...(live ? { 'data-live': '1' } : {}),
      },
      label || '',
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntityLinkView);
  },

  addCommands() {
    return {
      insertEntityLink:
        ({ kind, id, name, form = null }) =>
        ({ chain }) =>
          chain()
            .insertContent([
              { type: this.name, attrs: { kind, id, form, label: name || '', live: true } },
              { type: 'text', text: ' ' },
            ])
            .run(),
    };
  },

  // Вставка голого URL запису сайту (адресний рядок) → одразу чіп.
  addProseMirrorPlugins() {
    const type = this.type;
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            if (!view.editable) return false;
            const text = event.clipboardData?.getData('text/plain')?.trim();
            if (!text || /\s/.test(text)) return false;
            const parsed = parseEntityHref(text);
            if (!parsed) return false;
            view.dispatch(
              view.state.tr.replaceSelectionWith(type.create({ ...parsed, label: '', live: true })).scrollIntoView(),
            );
            return true;
          },
        },
      }),
    ];
  },
});

export default EntityLinkNode;
