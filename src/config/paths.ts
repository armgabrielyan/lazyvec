export const displayConfigPath = "~/.lazyvec/config.toml";

export function defaultConfigPath(home = process.env.HOME): string {
  if (!home) {
    return ".lazyvec/config.toml";
  }

  return `${home}/.lazyvec/config.toml`;
}
