export interface SseEvent {
  event: string;
  data: string;
  // The `id:` field: the position of this event in the reply's buffer on the server, for resuming.
  id?: number;
}

// Network chunks can split an event anywhere, so text is buffered until a blank line ends it.
export function createSseParser(onEvent: (e: SseEvent) => void): (chunk: string) => void {
  let buffer = "";
  return (chunk) => {
    buffer += chunk.replace(/\r\n/g, "\n");
    let end = buffer.indexOf("\n\n");
    while (end !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = "message";
      const data: string[] = [];
      let id: number | undefined;
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("id:")) {
          const n = Number(line.slice(3).trim());
          if (/^\d+$/.test(line.slice(3).trim()) && Number.isSafeInteger(n)) id = n;
        } else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      onEvent(id === undefined ? { event, data: data.join("\n") } : { event, data: data.join("\n"), id });
      end = buffer.indexOf("\n\n");
    }
  };
}
