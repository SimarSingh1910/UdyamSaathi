import { BUSINESS_TYPES, SEGMENT_LABELS } from "./advisor";
import { INTERNET_LABELS, NEED_LABELS, SEGMENT_GROUP_LABEL, STRINGS, typeText, type Text } from "./i18n";
import { LINE_LABEL, STATUS_LABEL } from "./order-flow";

/** Every fixed piece of customer-facing copy. Translated once per language and saved. */
export function catalog(): Text[] {
  const all: Text[] = [
    ...Object.values(STRINGS),
    ...Object.values(NEED_LABELS),
    ...Object.values(INTERNET_LABELS),
    ...Object.values(SEGMENT_GROUP_LABEL),
    ...Object.values(SEGMENT_LABELS),
    ...Object.values(STATUS_LABEL),
    ...Object.values(LINE_LABEL),
    ...Object.values(BUSINESS_TYPES).flat().map(typeText),
  ];
  const seen = new Set<string>();
  return all.filter((t) => (seen.has(t.en) ? false : (seen.add(t.en), true)));
}
