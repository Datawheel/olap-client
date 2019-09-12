import Level from "../level";
import Measure from "../measure";
import {Drillable, Query, QueryGrowth, QueryRCA, QueryTopk} from "../query";
import {undefinedHelpers} from "../utils";

export function logicLayerQueryBuilder(
  query: Query
): {[key: string]: string[] | string | number | boolean | undefined} {
  const {undefinedIfEmpty, undefinedIfIncomplete} = undefinedHelpers();

  const cube = query.cube;
  const options = query.getParam("options");
  const drilldowns = undefinedIfEmpty(
    query.getParam("drilldowns"),
    (d: Drillable) => (Level.isLevel(d) ? d.uniqueName : d.name)
  );
  const measures = undefinedIfEmpty(query.getParam("measures"), (m: Measure) => m.name);

  const tesseractQuery = {
    cube: cube.name,
    debug: options.debug ? true : undefined,
    drilldowns: drilldowns ? drilldowns.join(",") : undefined,
    locale: query.getParam("locale"),
    measures: measures ? measures.join(",") : undefined,
    parents: Boolean(options.parents),
    sparse: Boolean(options.sparse),
    growth: undefinedIfIncomplete(query.getParam("growth"), (g: Required<QueryGrowth>) =>
      [g.level.fullName, g.measure.name].join(",")
    ),
    rca: undefinedIfIncomplete(query.getParam("rca"), (r: Required<QueryRCA>) =>
      [r.level1.fullName, r.level2.fullName, r.measure.name].join(",")
    ),
    top: undefinedIfIncomplete(query.getParam("topk"), (t: Required<QueryTopk>) =>
      [t.amount, t.level.fullName, t.measure.name, t.order].join(",")
    )
  };

  const cuts = query.getParam("cuts");
  for (let level of cube.levelIterator) {
    if (cuts.hasOwnProperty(level.fullName)) {
      tesseractQuery[level.uniqueName] = cuts[level.fullName].join(",");
    }
  }

  return tesseractQuery;
}
