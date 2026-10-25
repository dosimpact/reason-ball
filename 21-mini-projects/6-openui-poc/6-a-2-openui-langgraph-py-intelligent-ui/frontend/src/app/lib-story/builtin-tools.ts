/** Per-preview in-memory tools: Query/Mutation examples never contact a server or storage. */
export function createBuiltinDemoTools() {
  let value = 0;
  let calls = 0;
  return {
    read_demo: async (args: Record<string, unknown>) => {
      const factor = typeof args.factor === "number" ? args.factor : 1;
      return { value, calls: ++calls, rows: [{ name: "A", value: 10 * factor }, { name: "B", value: 20 * factor }] };
    },
    write_demo: async (args: Record<string, unknown>) => {
      if (typeof args.value !== "number" || !Number.isFinite(args.value)) {
        throw new Error("value must be a finite number");
      }
      value = args.value;
      return { value };
    },
  };
}
