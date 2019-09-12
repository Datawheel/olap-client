import Measure from "../measure";
import {Drillable, Query, QueryFilter, QueryProperty} from "../query";
import {undefinedHelpers} from "../utils";
import {stringifyCut} from "./utils";

export function aggregateQueryBuilder(query: Query): MondrianAggregateURLSearchParams {
  const {undefinedIfEmpty, undefinedIfKeyless, undefinedIfZero} = undefinedHelpers();

  const options = query.getParam("options");
  return {
    caption: query.getParam("captions"),
    cut: undefinedIfKeyless(query.getParam("cuts"), stringifyCut),
    debug: options.debug,
    distinct: options.distinct,
    drilldown: undefinedIfEmpty(
      query.getParam("drilldowns"),
      (d: Drillable) => d.fullName
    ),
    filter: undefinedIfEmpty(
      query.getParam("filters"),
      (f: QueryFilter) => `${f.measure.name} ${f.comparison} ${f.value}`
    ),
    limit: undefinedIfZero(query.getParam("limit")),
    measures: undefinedIfEmpty(query.getParam("measures"), (m: Measure) => m.name),
    nonempty: options.nonempty,
    offset: undefinedIfZero(query.getParam("offset")),
    order_desc: query.getParam("orderDescendent") ? true : undefined,
    order: query.getParam("orderProperty"),
    parents: options.parents,
    properties: undefinedIfEmpty(
      query.getParam("properties"),
      (p: QueryProperty) => `${p.level.fullName}.${p.name}`
    ),
    sparse: options.sparse
  };
}
