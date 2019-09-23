import Level from "../level";
import Measure from "../measure";
import {Drillable, Query, QueryFilter, QueryProperty} from "../query";
import {undefinedHelpers} from "../utils";
import {stringifyCut} from "./utils";

export function aggregateQueryBuilder(query: Query): MondrianAggregateURLSearchParams {
  const {undefinedIfEmpty, undefinedIfKeyless, undefinedIfZero} = undefinedHelpers();

  const captions = query.getParam("captions");

  const locale = query.getParam("locale").slice(0, 2);
  const localeTester = new RegExp(`^${locale}\\s|\\s${locale}$`, "i");
  query.getParam("drilldowns").forEach(dd => {
    // the future implementation of namedset will require this
    if (Level.isLevel(dd)) {
      const localeProp = dd.properties.find(prop => localeTester.test(prop.name));
      if (localeProp) {
        captions.push(dd.fullName.concat(".", localeProp.name));
      }
    }
  });

  const options = query.getParam("options");
  return {
    caption: undefinedIfEmpty(captions),
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
