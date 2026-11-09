// CSV "formatter": parses with the RFC 4180 parser from src/convert/csv.js
// and re-serialises, which normalises quoting (only where needed), line
// endings (LF) and the trailing newline. Cell contents are never changed.
// Malformed input (unterminated quotes, junk after a closing quote) raises
// a FormatError-compatible ConvertError with the line number.
import { parseCsv, stringifyCsv } from "../convert/csv.js";

export function formatCsv(src) {
  return stringifyCsv(parseCsv(src));
}
