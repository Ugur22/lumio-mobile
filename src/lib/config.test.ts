import { describe, expect, it } from "vitest";
import { pickDefaultServer } from "./config";

const DEPLOYED = "https://16-192-71-141.sslip.io";

describe("pickDefaultServer", () => {
  it("uses the deployed server without an override", () => {
    expect(pickDefaultServer(undefined)).toBe(DEPLOYED);
    expect(pickDefaultServer("")).toBe(DEPLOYED);
  });

  it("accepts a local server and normalizes it like the login screen does", () => {
    expect(pickDefaultServer("http://127.0.0.1:18766")).toBe("http://127.0.0.1:18766");
    expect(pickDefaultServer("http://192.168.1.20:18766/")).toBe("http://192.168.1.20:18766");
  });

  it("falls back to the deployed server for an address the login screen would refuse", () => {
    expect(pickDefaultServer("http://example.com")).toBe(DEPLOYED);
    expect(pickDefaultServer("https://user:pass@example.com")).toBe(DEPLOYED);
    expect(pickDefaultServer("not a url")).toBe(DEPLOYED);
  });
});
