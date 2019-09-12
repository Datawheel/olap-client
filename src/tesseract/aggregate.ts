import {
  Query,
  Drillable,
  QueryFilter,
  QueryGrowth,
  QueryProperty,
  QueryRCA,
  QueryTopk
} from "../query";
import {undefinedHelpers} from "../utils";
import Measure from "../measure";
import {ClientError} from "../errors";
import {stringifyCut, joinFullName} from "./utils";

export function aggregateQueryBuilder(query: Query): TesseractAggregateURLSearchParams {
  const {
    undefinedIfEmpty,
    undefinedIfIncomplete,
    undefinedIfKeyless,
    undefinedIfZero
  } = undefinedHelpers();

  const drilldowns = undefinedIfEmpty(
    query.getParam("drilldowns"),
    (d: Drillable) => d.fullName
  );
  const measures = undefinedIfEmpty(query.getParam("measures"), (m: Measure) => m.name);

  if (!drilldowns || !measures) {
    const lost = [!drilldowns && "drilldowns", !measures && "measures"].filter(Boolean);
    throw new ClientError(`Invalid Query: missing ${lost.join(" and ")}`);
  }

  const options = query.getParam("options");
  return {
    captions: query.getParam("captions"),
    cuts: undefinedIfKeyless(query.getParam("cuts"), stringifyCut),
    debug: options.debug ? true : undefined,
    drilldowns,
    exclude_default_members: undefined,
    filters: undefinedIfEmpty(
      query.getParam("filters"),
      (f: QueryFilter) => `${f.measure.name} ${f.comparison} ${f.value}`
    ),
    growth: undefinedIfIncomplete(
      query.getParam("growth"),
      (g: Required<QueryGrowth>) => `${g.level.fullName},${g.measure.name}`
    ),
    limit: undefinedIfZero(query.getParam("limit")),
    measures,
    parents: Boolean(options.parents),
    properties: undefinedIfEmpty(query.getParam("properties"), (p: QueryProperty) =>
      joinFullName([p.level.dimension.name, p.level.hierarchy.name, p.level.name, p.name])
    ),
    rate: undefined,
    rca: undefinedIfIncomplete(
      query.getParam("rca"),
      (r: Required<QueryRCA>) =>
        `${r.level1.fullName},${r.level2.fullName},${r.measure.name}`
    ),
    sort: undefined,
    sparse: Boolean(options.sparse),
    top_where: undefined,
    top: undefinedIfIncomplete(
      query.getParam("topk"),
      (t: Required<QueryTopk>) =>
        `${t.amount},${t.level.fullName},${t.measure.name},${t.order}`
    )
  };
}
