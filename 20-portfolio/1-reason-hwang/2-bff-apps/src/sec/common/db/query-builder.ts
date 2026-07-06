import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export function addWhere<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  condition: string,
  parameters?: ObjectLiteral,
): SelectQueryBuilder<T> {
  return query.expressionMap.wheres.length > 0
    ? query.andWhere(condition, parameters)
    : query.where(condition, parameters);
}
