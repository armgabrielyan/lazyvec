export function clipboardCommand(platform: string): string[] | null {
  switch (platform) {
    case "darwin":
      return ["pbcopy"];
    case "linux":
      return ["xclip", "-selection", "clipboard"];
    case "win32":
      return ["clip"];
    default:
      return null;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  const command = clipboardCommand(process.platform);

  if (command === null) {
    return false;
  }

  try {
    const proc = Bun.spawn(command, { stdin: "pipe" });
    proc.stdin.write(text);
    proc.stdin.end();
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}
