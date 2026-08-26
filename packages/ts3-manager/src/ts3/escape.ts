export function escapeQueryValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\//g, '\\/')
    .replace(/ /g, '\\s')
    .replace(/\|/g, '\\p');
}

export function unescapeQueryValue(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i] as string;
    if (ch !== '\\' || i + 1 >= value.length) {
      out += ch;
      continue;
    }
    const next = value[i + 1] as string;
    if (next === 's') out += ' ';
    else if (next === 'p') out += '|';
    else if (next === '/') out += '/';
    else if (next === '\\') out += '\\';
    else {
      out += ch;
      out += next;
    }
    i += 1;
  }
  return out;
}

export function splitEntries(line: string): string[] {
  return line.split('|');
}

export function parseKeyValueLine(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  let key = '';
  let value = '';
  let inValue = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] as string;
    if (ch === '\\' && i + 1 < line.length) {
      const escaped = line.slice(i, i + 2);
      if (inValue) value += escaped;
      else key += escaped;
      i += 1;
      continue;
    }
    if (ch === '=' && !inValue) {
      inValue = true;
      continue;
    }
    if (ch === ' ' && inValue) {
      out[unescapeQueryValue(key)] = unescapeQueryValue(value);
      key = '';
      value = '';
      inValue = false;
      continue;
    }
    if (inValue) value += ch;
    else key += ch;
  }
  if (key.length > 0 || value.length > 0) {
    out[unescapeQueryValue(key)] = unescapeQueryValue(value);
  }
  return out;
}
