// Regex tester worker: runs patterns off the main thread so a catastrophic
// one can be killed (see runner.js). All logic lives in core.js.
import { handleRegexMessage, startedMessage } from "./core.js";

self.onmessage = (e) => {
  self.postMessage(startedMessage(e.data));
  self.postMessage(handleRegexMessage(e.data));
};
