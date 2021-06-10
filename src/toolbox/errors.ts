import { AxiosResponse } from "axios";

export class ServerError extends Error {
  public readonly body: any;
  public readonly detail: any;
  public readonly status: number;

  constructor(response: AxiosResponse<any>, message?: string) {
    const errMessage = message || (
      response.data ? response.data.error || response.data :
      /* else */      response.statusText
    );

    super(errMessage);

    this.status = response.status;
    this.body = response.data;

    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
