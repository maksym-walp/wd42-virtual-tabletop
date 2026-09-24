import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import RollButton from '../../RollButton';

// The interactive dice-roll badge, as a NodeView — same visual/behavior as
// the old SmartTextReader's DiceTag, just mounted inside a TipTap document
// instead of produced by regex-splitting a `[[formula]]` string.
function DiceRollView({ node }) {
  const { formula } = node.attrs;
  return (
    <NodeViewWrapper as="span" contentEditable={false} className="inline-block align-middle">
      <RollButton
        formula={formula}
        size={12}
        className="mx-0.5 rounded border border-accent/60 px-1.5 py-0.5 text-xs font-semibold align-middle"
      >
        {formula}
      </RollButton>
    </NodeViewWrapper>
  );
}

// Atomic inline node: `formula` is the only state, serialized to/from
// `<span data-type="dice-roll" data-formula="...">` so `editor.getHTML()`
// output stays stable storage and round-trips through both the editable
// SmartTextarea and the read-only SmartTextReader.
const DiceRollNode = Node.create({
  name: 'diceRoll',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-formula') || '',
        renderHTML: (attrs) => ({ 'data-formula': attrs.formula }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="dice-roll"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'dice-roll' }), node.attrs.formula || ''];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DiceRollView);
  },

  addCommands() {
    return {
      insertDiceRoll:
        (formula) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { formula } }).run(),
    };
  },
});

export default DiceRollNode;
