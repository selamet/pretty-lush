import JwtModal from "./JwtModal.jsx";

// Registry of tool modals opened from ⌘K tools (see `modal` entries in
// src/commands/text-tools.js). Each component receives `result` (the tool's
// decoded data) and `onClose`. To add a tool modal: create the component
// here in src/components/, register it below, and add a TEXT_TOOLS entry.
const TOOL_MODALS = {
  jwt: JwtModal,
};

// `modal` is `{ id, result }` or null.
export default function ToolModalHost({ modal, onClose }) {
  const Modal = modal && TOOL_MODALS[modal.id];
  if (!Modal) return null;
  return <Modal result={modal.result} onClose={onClose} />;
}
