import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase simulé : chaque appel à from() consomme le résultat planifié
 * suivant et journalise la chaîne d'appels pour les assertions.
 */
export interface FakeResult {
  readonly data?: unknown;
  readonly error?: { message: string } | null;
}

export interface RecordedCall {
  readonly table: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

class FakeBuilder implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  constructor(
    private readonly table: string,
    private readonly result: FakeResult,
    private readonly calls: RecordedCall[],
  ) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ table: this.table, method, args });
    return this;
  }

  insert(...args: unknown[]) {
    return this.record("insert", args);
  }
  update(...args: unknown[]) {
    return this.record("update", args);
  }
  delete(...args: unknown[]) {
    return this.record("delete", args);
  }
  select(...args: unknown[]) {
    return this.record("select", args);
  }
  eq(...args: unknown[]) {
    return this.record("eq", args);
  }

  private resolve() {
    return { data: this.result.data ?? null, error: this.result.error ?? null };
  }

  maybeSingle() {
    this.record("maybeSingle", []);
    return Promise.resolve(this.resolve());
  }

  then<R1, R2>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

export function fakeSupabase(plan: readonly FakeResult[]) {
  const remaining = [...plan];
  const calls: RecordedCall[] = [];
  const client = {
    from(table: string) {
      const result = remaining.shift();
      if (!result) throw new Error(`Plan épuisé : appel from("${table}") imprévu`);
      return new FakeBuilder(table, result, calls);
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}
