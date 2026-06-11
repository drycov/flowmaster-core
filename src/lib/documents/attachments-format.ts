/** Plain-text block for template field «attachments» / «Приложение». */
export function formatAttachmentsListText(
  items: Array<{ file_name: string } | { name: string }>,
): string {
  if (items.length === 0) return "";
  return items
    .map((item, index) => {
      const name = "file_name" in item ? item.file_name : item.name;
      return `${index + 1}. ${name.trim()}`;
    })
    .join("\n");
}
