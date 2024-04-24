import Axios, { AxiosInstance } from "axios";
import { Aggregation, IDataSource, ServerStatus } from "../interfaces/contracts";
import { TesseractDataResponse, TesseractStatus } from "./schema";
import { Query } from "../query";
import { buildSearchParams } from "./adapter";

const softwareName = "python:tesseract-olap";

export class TesseractDataSource implements IDataSource {
	axiosInstance: AxiosInstance;
	serverOnline = false;
	serverSoftware = softwareName;
	serverUrl: string;
	serverVersion: string;

	static softwareName = softwareName;

	constructor(baseURL: string) {
		if (!baseURL || typeof baseURL !== "string") {
			throw new TypeError(`Invalid tesseract-olap server URL: ${baseURL}`);
		}
		this.axiosInstance = Axios.create({ baseURL });
		this.serverUrl = baseURL;
	}

	checkStatus(): Promise<ServerStatus> {
		return this.axiosInstance.get<TesseractStatus>("/").then(
			(response) => {
				const { version } = response.data;
				this.serverOnline = true;
				this.serverVersion = version;
				return {
					software: softwareName,
					online: this.serverOnline,
					url: this.serverUrl,
					version: version
				};
			},
			(error) => {
				this.serverOnline = false;
				throw error;
			},
		);
	}

	execQuery(query: Query): Promise<Aggregation> {
		const params = buildSearchParams(query);
		return this.axiosInstance
			.get<TesseractDataResponse>("data.jsonarrays", { params })
			.then(response => {
				const { columns, data } = response.data;
				return {
					data: data.map(item =>
						Object.fromEntries(columns.map((name, i) => [name, item[i]]))
					),
					headers: { ...response.headers } as Record<string, string>,
					query,
					status: response.status,
					url: response.request.url,
				}
			})
	}
}
