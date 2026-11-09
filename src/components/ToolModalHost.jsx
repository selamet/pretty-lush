import JwtModal from "./JwtModal.jsx";
import HashModal from "./HashModal.jsx";
import IdsModal from "./IdsModal.jsx";

// Registry of tool modals opened from ⌘K tools (see `modal` entries in
// src/commands/text-tools.js, and "Generate N UUIDs…" in commands/index.js).
// Each component receives `result` (the tool's decoded data), `onClose` and
// `onInsert(text, label)` (put text at the input cursor). To add a tool
// modal: create the component here in src/components/, register it below,
// and add a TEXT_TOOLS entry.
const TOOL_MODALS = {
  jwt: JwtModal,
  hash: HashModal,
  ids: IdsModal,
};

// `modal` is `{ id, result }` or null.
export default function ToolModalHost({ modal, onClose, onInsert }) {
  const Modal = modal && TOOL_MODALS[modal.id];
  if (!Modal) return null;
  return <Modal result={modal.result} onClose={onClose} onInsert={onInsert} />;
}
