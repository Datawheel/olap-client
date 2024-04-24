import { Query } from "../query";
import { TesseractDataRequest } from "./schema";

export function buildSearchParams(query: Query): TesseractDataRequest {
    const getName = (item: {name: string}) => item.name;

    const options = query.getParam("options");
    const pagination = query.getParam("pagination");
    const sorting = query.getParam("sorting");

    return {
        cube: query.cube.name,
        drilldowns: query.getParam("drilldowns").map(getName),
        measures: query.getParam("measures").map(getName),
        locale: query.getParam("locale"),
        limit: `${pagination.limit},${pagination.offset}`,
        properties: query.getParam("properties").map(getName),
        sort: sorting.property ? `${getName(sorting.property)}.${sorting.direction}`,
        time?: string;
        exclude?: string | string[];
        include?: string | string[];
        filters?: string | string[];
        parents: options.parents || undefined,
    }
}
