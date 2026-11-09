import { FormatError } from "../formatters/errors.js";

// Raised when input can't be parsed as the source format or the parsed
// value can't be represented in the target format. Same shape as
// FormatError (message, line, column, hint) so ErrorCard can render it.
export class ConvertError extends FormatError {
  constructor(message, opts) {
    super(message, opts);
    this.name = "ConvertError";
  }
}
