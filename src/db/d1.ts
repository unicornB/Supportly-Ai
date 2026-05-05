export type D1RunResult = D1Result<unknown>;

export async function firstOrNull<T>(statement: D1PreparedStatement): Promise<T | null> {
  return (await statement.first<T>()) ?? null;
}
