import {ClientError} from "../errors";
import Level from "../level";
import Measure from "../measure";
import {
  Drillable,
  Query,
  QueryFilter,
  QueryGrowth,
  QueryProperty,
  QueryRCA,
  QueryTopk
} from "../query";
import {undefinedHelpers} from "../utils";
import {joinFullName, stringifyCut} from "./utils";

export function aggregateQueryBuilder(query: Query): TesseractAggregateURLSearchParams {
  const {
    undefinedIfEmpty,
    undefinedIfIncomplete,
    undefinedIfKeyless,
    undefinedIfZero
  } = undefinedHelpers();

  const captions = query.getParam("captions");

  const locale = query.getParam("locale").slice(0, 2);
  if (locale) {
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
  }

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
    captions: undefinedIfEmpty(captions),
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
