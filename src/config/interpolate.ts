export type EnvGetter = (name: string) => string | undefined;

const ENV_PATTERN = /\$\{([^}]*)\}/g;
const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface InterpolateResult {
  value: string;
  interpolated: boolean;
}

export function interpolateEnvVars(
  raw: string,
  envGetter: EnvGetter,
  context: string,
): InterpolateResult {
  let interpolated = false;

  const value = raw.replace(ENV_PATTERN, (_, rawName: string) => {
    interpolated = true;
    const name = rawName.trim();

    if (name === "" || !VALID_NAME.test(name)) {
      throw new Error(`${context} has malformed environment variable reference "\${${rawName}}"`);
    }

    const resolved = envGetter(name);
    if (resolved === undefined || resolved === "") {
      throw new Error(`${context} references environment variable "${name}" which is not set`);
    }

    return resolved;
  });

  return { value, interpolated };
}

export function defaultEnvGetter(name: string): string | undefined {
  return process.env[name];
}
