export function fmt(result: { messages: unknown[]; error?: string }): string {
  let text = "";
  if (result.error) text = `Error: ${result.error}\n\nMessages:\n${JSON.stringify(result.messages, null, 2)}`;
  else if (result.messages.length === 1) text = JSON.stringify(result.messages[0], null, 2);
  else text = JSON.stringify(result.messages, null, 2);
  
  // Truncate to avoid context explosion
  const maxLen = 30000;
  if (text.length > maxLen) {
    return text.substring(0, maxLen) + `\n... [TRUNCATED (${text.length} bytes total, showing first ${maxLen}. Use pagination to view more)] ...`;
  }
  return text;
}
