export const LADOS_START_MARKER = "# >>> LADOS DOMAINS START >>>";
export const LADOS_END_MARKER = "# >>> LADOS DOMAINS END >>>";

/**
 * Returns the OS hosts file path.
 */
export function getSystemHostsPath(): string {
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
  if (isWindows) {
    return "C:\\Windows\\System32\\drivers\\etc\\hosts";
  }
  return "/etc/hosts";
}

/**
 * Parses Lados domains currently present inside the marker block in the hosts content.
 */
export function extractLadosDomains(content: string): string[] {
  const startIndex = content.indexOf(LADOS_START_MARKER);
  const endIndex = content.indexOf(LADOS_END_MARKER);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return [];
  }

  const block = content.substring(startIndex + LADOS_START_MARKER.length, endIndex);
  const lines = block.split(/\r?\n/);
  const domains: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Line format: 127.0.0.1 domain.test
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && parts[0] === "127.0.0.1") {
      domains.push(parts[1]);
    }
  }

  return [...new Set(domains)];
}

/**
 * Formats the Lados domain block to be injected into the hosts file.
 */
export function formatLadosBlock(domains: string[]): string {
  const domainList = domains.length > 0 ? domains : ["welcome.test"];
  const lines = domainList.map((d) => `127.0.0.1 ${d}`);

  return `${LADOS_START_MARKER}\n${lines.join("\n")}\n${LADOS_END_MARKER}`;
}

/**
 * Updates hosts content by replacing or appending the Lados marker block.
 */
export function mergeHostsContent(existingContent: string, domains: string[]): string {
  const formattedBlock = formatLadosBlock(domains);
  const startIndex = existingContent.indexOf(LADOS_START_MARKER);
  const endIndex = existingContent.indexOf(LADOS_END_MARKER);

  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    // Replace existing block
    const before = existingContent.substring(0, startIndex).trimEnd();
    const after = existingContent.substring(endIndex + LADOS_END_MARKER.length).trimStart();
    return `${before}\n\n${formattedBlock}\n\n${after}`.trim() + "\n";
  }

  // Append new block
  const trimmed = existingContent.trimEnd();
  return `${trimmed}\n\n${formattedBlock}\n`;
}
