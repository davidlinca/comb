// Erori in forma din contractul API: { "error": { "code", "message", "fields"? } }

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: string[];
  constructor(status: number, code: string, message: string, fields?: string[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const bad = (code: string, message: string, fields?: string[]) => new ApiError(400, code, message, fields);
export const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', 'Trebuie sa fii autentificat.');
export const forbidden = (message = 'Nu ai acces la aceasta resursa.') => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Nu am gasit ce ai cerut.') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);

/** Citeste corpul JSON; daca nu e JSON valid -> 400. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b === null || typeof b !== 'object' || Array.isArray(b)) throw new Error();
    return b as Record<string, unknown>;
  } catch {
    throw bad('VALIDATION', 'Corpul cererii trebuie sa fie un obiect JSON.');
  }
}

/** Accepta doar cheile permise; orice alt camp -> 400 (nu primim date pe care nu le folosim). */
export function onlyKeys(body: Record<string, unknown>, allowed: string[]) {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) throw bad('VALIDATION', 'Am primit campuri pe care nu le folosim.', extra);
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
