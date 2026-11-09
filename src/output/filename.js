// Download filename for formatted output, e.g. "formatted.py".
export function outputFilename(language) {
  return `formatted${language?.ext ? `.${language.ext}` : ""}`;
}
