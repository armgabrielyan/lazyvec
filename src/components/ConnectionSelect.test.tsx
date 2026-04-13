import { describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { ConnectionSelect } from "./ConnectionSelect";

describe("ConnectionSelect", () => {
  test("renders onboarding copy when no connections are configured", async () => {
    const testSetup = await testRender(
      <ConnectionSelect
        configPath="~/.lazyvec/config.toml"
        connections={[]}
        selectedIndex={0}
        statuses={{}}
      />,
      { width: 80, height: 24 },
    );

    await act(async () => {
      await testSetup.renderOnce();
    });

    const frame = testSetup.captureCharFrame();
    expect(frame).toContain("No connections configured.");
    expect(frame).toContain("~/.lazyvec/config.toml");
    expect(frame).toContain("[connections.local-qdrant]");

    act(() => {
      testSetup.renderer.destroy();
    });
  });
});
